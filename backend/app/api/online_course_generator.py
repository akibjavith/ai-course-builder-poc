from fastapi import APIRouter, HTTPException
import logging
import asyncio
from pydantic import BaseModel, Field

logger = logging.getLogger("online_course_generator")
from typing import List, Optional, Dict, Any
import requests
import json
import os
import uuid

from course_planner import generate_course_structure
from content_generator import generate_chapter_content, generate_course_quiz
# video_compiler is imported lazily inside functions that need it
from openai import OpenAI
from schemas import ImagePromptResponse, ImageResponse
from schemas import (
    OutlineRequest, ChapterContent, CourseQuiz, CourseDetails,
    LessonRequest, QuizRequest, StoreCourseRequest, LessonBlocksResponse
)


_client = None

def get_openai_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client

router = APIRouter(prefix="/course", tags=["online_course_generator"])

# In-memory store for async tasks: { task_id: { "status": str, "progress": int, "message": str, "result": any } }
TASK_STORE: Dict[str, Dict[str, Any]] = {}

# Using schemas from schemas.py instead of local definitions

@router.post("/outline")
async def generate_outline(req: OutlineRequest):
    try:
        structure = generate_course_structure(
            courseName=req.courseName,
            description=req.description,
            subject=req.subject,
            level=req.level
        )
        return structure
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lesson")
async def generate_lesson(req: LessonRequest):
    raise HTTPException(
        status_code=404,
        detail="This endpoint has been deprecated and disabled. Please use /course/lesson-blocks instead."
    )

@router.post("/lesson-blocks", response_model=LessonBlocksResponse)
async def generate_lesson_blocks(req: LessonRequest):
    try:
        course_title = req.course_details.courseName if req.course_details else "the course"
        course_desc = req.course_details.description if req.course_details else ""
        subject = req.course_details.subject if req.course_details else "General"
        difficulty = req.course_details.level if req.course_details else "beginner"
        objectives = req.course_details.requirements if req.course_details else ""

        prompt_str = f"""
        Generate structured block-based educational content for the lesson '{req.title}' in the module '{req.module_title}' for the course '{course_title}'.
        Course Description: {course_desc}
        Subject: {subject}
        Difficulty: {difficulty}
        Audience: {objectives}
        
        Additional prompt instructions / focus areas: {req.prompt or 'None'}

        CRITICAL - LEARNER-READY PUBLISHING PRINCIPLE:
        You are the textbook author writing directly to the learner. Do NOT write teacher guidelines, lesson plans, class activity instructions, or summaries of what the lesson will cover (e.g. do NOT say "In this section we will learn...", "The teacher should show...", "Students will practice the alphabet..."). Instead, write and teach the actual educational content directly.
        - Do not describe activities; write the actual activities and exercises.
        - Do not describe examples; write the actual examples out in full.
        - Do not list instructions for a quiz; write the actual quiz questions, options, correct answers, and thorough explanation text.
        - Do not explain what a vocabulary word is; write the word, its meaning, and its usage example.

        You MUST structure your response as a list of distinct content blocks. Choose the best dynamic sequence of blocks that fits this topic. Do not just use one block type; create a rich learning flow.
        
        The allowed block types and their exact structure/rules are:
        1. "heading": level (1, 2, or 3), text. Use this for outline and sub-topics.
        2. "paragraph": text. CRITICAL: Every paragraph block MUST be a deep-dive, comprehensive, and highly detailed explanation containing between 150 to 250 words. Do not write short paragraphs. Write directly to the student.
        3. "bullet_list": items (list of strings). Must contain at least 3-5 distinct points.
        4. "numbered_list": items (list of strings). Must contain at least 3-5 sequential steps or items.
        5. "image": url (always output "" for now), caption (describe what the visual should represent).
        6. "video": url (always output "" for now), caption (describe what the video/narration should show).
        7. "table": headers (list of strings), rows (list of lists of strings). Used for comparisons, classifications, and vocabulary guides. Every cell must contain actual comparative or vocabulary data (e.g., word, meaning, example sentence), not descriptions.
        8. "callout": text, callout_type (one of: "info", "warning", "tip", "danger").
        9. "code": language, code, explanation. Write actual functional code without markdown backticks inside the code field.
        10. "example": scenario, detail. Real-world scenario case study, math calculation, or code walk-through. Must contain the complete scenario and result.
        11. "quiz": question, options (list of strings), correctAnswer (the exact string from options), explanation. Make sure the question is actual learner assessment, not placeholder text.
        12. "assignment": task, instructions, grading_criteria (list of strings). Write actual tasks the student can work on.
        13. "knowledge_check": question, options (list of strings), answer (the exact string from options), explanation.
        14. "summary": points (list of strings summarizing key takeaways).
        15. "reference": title, url (trusted educational platforms/documentation, no hallucinated URLs).

        SUBJECT ADAPTATION MATRIX:
        - Language Lessons: Use paragraph blocks for reading passages, code blocks or paragraph blocks formatted as dialogue scripts (e.g., Speaker A vs Speaker B), and table blocks for vocabulary definitions.
        - Programming Lessons: Use code blocks for fully functional code snippets and explanations, and paragraph blocks for code analysis.
        - Mathematics Lessons: Use paragraph blocks for step-by-step worked solutions and example blocks for math problem solving.
        - Science Lessons: Detail observations, case studies, or step-by-step experiments.
        - Cybersecurity Lessons: Detail security configurations, threat analyses, and interactive scenarios.
        - Business Lessons: Detail case study text, strategic analyses, and practical scenarios.

        Ensure to output ONLY valid JSON matching this schema:
        {{
            "title": "{req.title}",
            "blocks": [
                {{
                    "type": "heading",
                    "level": 1,
                    "text": "..."
                }},
                {{
                    "type": "paragraph",
                    "text": "..."
                }},
                ...
            ]
        }}
        """

        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional educational content architect. Output JSON only."},
                {"role": "user", "content": prompt_str}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        lesson_data = json.loads(response.choices[0].message.content)
        
        # Coerce output to dictionary with blocks list
        if isinstance(lesson_data, list):
            lesson_data = {
                "title": req.title,
                "blocks": lesson_data
            }
        elif not isinstance(lesson_data, dict):
            lesson_data = {
                "title": req.title,
                "blocks": []
            }
            
        if "title" not in lesson_data or not lesson_data["title"]:
            lesson_data["title"] = req.title
            
        if "blocks" not in lesson_data or not isinstance(lesson_data["blocks"], list):
            found_blocks = False
            for k, v in lesson_data.items():
                if isinstance(v, list) and k != "title":
                    lesson_data["blocks"] = v
                    found_blocks = True
                    break
            if not found_blocks:
                lesson_data["blocks"] = []

        cleaned_blocks = []
        for block in lesson_data["blocks"]:
            if not isinstance(block, dict):
                if isinstance(block, str):
                    cleaned_blocks.append({
                        "type": "paragraph",
                        "text": block
                    })
                continue
            cleaned_blocks.append(block)
        lesson_data["blocks"] = cleaned_blocks

        # Normalize fields to make Pydantic validation extremely robust and eliminate 500 errors
        for block in lesson_data["blocks"]:
            # Normalize block type name
            if "type" in block and isinstance(block["type"], str):
                t = block["type"].lower().replace("-", "_").replace(" ", "_").strip()
                type_mapping = {
                    "bulletlist": "bullet_list",
                    "unordered_list": "bullet_list",
                    "unorderedlist": "bullet_list",
                    "ordered_list": "numbered_list",
                    "orderedlist": "numbered_list",
                    "numberedlist": "numbered_list",
                    "code_block": "code",
                    "example_block": "example",
                    "quiz_block": "quiz",
                    "assignment_block": "assignment",
                    "knowledgecheck": "knowledge_check",
                    "knowledge-check": "knowledge_check",
                    "summary_block": "summary",
                    "reference_block": "reference",
                    "table_block": "table",
                    "callout_block": "callout"
                }
                if t in type_mapping:
                    block["type"] = type_mapping[t]
                else:
                    block["type"] = t
            else:
                # Infer type if missing
                if "code" in block or "language" in block:
                    block["type"] = "code"
                elif "scenario" in block or "detail" in block:
                    block["type"] = "example"
                elif "correctAnswer" in block:
                    block["type"] = "quiz"
                elif "answer" in block:
                    block["type"] = "knowledge_check"
                elif "task" in block or "grading_criteria" in block:
                    block["type"] = "assignment"
                elif "points" in block:
                    block["type"] = "summary"
                elif "headers" in block or "rows" in block:
                    block["type"] = "table"
                elif "level" in block:
                    block["type"] = "heading"
                elif "url" in block and ("caption" in block or "image" in block):
                    block["type"] = "image"
                elif "items" in block:
                    block["type"] = "bullet_list"
                elif "callout_type" in block:
                    block["type"] = "callout"
                else:
                    block["type"] = "paragraph"

            # Fallback to paragraph for unsupported types
            allowed_types = {
                "heading", "paragraph", "bullet_list", "numbered_list", "image", "video", 
                "table", "callout", "code", "example", "quiz", "assignment", 
                "knowledge_check", "summary", "reference"
            }
            if block.get("type") not in allowed_types:
                block["type"] = "paragraph"
                block["text"] = str(block.get("text") or json.dumps(block))

            block_type = block["type"]
            
            # Coerce and validate block properties
            if block_type == "heading":
                block["text"] = str(block.get("text") or "")
                if "level" in block:
                    try:
                        block["level"] = int(block["level"])
                    except:
                        block["level"] = 1
                else:
                    block["level"] = 1
                    
            elif block_type == "paragraph":
                block["text"] = str(block.get("text") or "")
                
            elif block_type in ["bullet_list", "numbered_list"]:
                items = block.get("items")
                if items is None:
                    block["items"] = []
                elif isinstance(items, list):
                    block["items"] = [str(x) for x in items if x is not None]
                else:
                    block["items"] = [str(items)]
                    
            elif block_type in ["image", "video"]:
                block["url"] = str(block.get("url") or "")
                block["caption"] = str(block.get("caption") or "")
                
            elif block_type == "table":
                headers = block.get("headers")
                if headers is None:
                    block["headers"] = []
                elif isinstance(headers, list):
                    block["headers"] = [str(x) for x in headers if x is not None]
                else:
                    block["headers"] = [str(headers)]
                    
                rows = block.get("rows")
                if rows is None:
                    block["rows"] = []
                elif isinstance(rows, list):
                    normalized_rows = []
                    for row in rows:
                        if isinstance(row, list):
                            normalized_rows.append([str(cell) for cell in row if cell is not None])
                        else:
                            normalized_rows.append([str(row)])
                    block["rows"] = normalized_rows
                else:
                    block["rows"] = [[str(rows)]]
                    
            elif block_type == "callout":
                block["text"] = str(block.get("text") or "")
                block["callout_type"] = str(block.get("callout_type") or "info")
                
            elif block_type == "code":
                block["language"] = str(block.get("language") or "")
                block["code"] = str(block.get("code") or "")
                block["explanation"] = str(block.get("explanation") or "")
                
            elif block_type == "example":
                block["scenario"] = str(block.get("scenario") or "")
                block["detail"] = str(block.get("detail") or "")
                
            elif block_type == "quiz":
                block["question"] = str(block.get("question") or "")
                options = block.get("options")
                if options is None:
                    block["options"] = []
                elif isinstance(options, list):
                    block["options"] = [str(x) for x in options if x is not None]
                else:
                    block["options"] = [str(options)]
                    
                correct_answer = block.get("correctAnswer") or block.get("answer") or ""
                if isinstance(correct_answer, int) and 0 <= correct_answer < len(block["options"]):
                    correct_answer = block["options"][correct_answer]
                block["correctAnswer"] = str(correct_answer)
                block["explanation"] = str(block.get("explanation") or "")
                
                if block["options"] and block["correctAnswer"] not in block["options"]:
                    block["options"].append(block["correctAnswer"])
                    
            elif block_type == "assignment":
                block["task"] = str(block.get("task") or "")
                block["instructions"] = str(block.get("instructions") or "")
                grading = block.get("grading_criteria")
                if grading is None:
                    block["grading_criteria"] = []
                elif isinstance(grading, list):
                    block["grading_criteria"] = [str(x) for x in grading if x is not None]
                else:
                    block["grading_criteria"] = [str(grading)]
                    
            elif block_type == "knowledge_check":
                block["question"] = str(block.get("question") or "")
                options = block.get("options")
                if options is None:
                    block["options"] = []
                elif isinstance(options, list):
                    block["options"] = [str(x) for x in options if x is not None]
                else:
                    block["options"] = [str(options)]
                    
                answer = block.get("answer") or block.get("correctAnswer") or ""
                if isinstance(answer, int) and 0 <= answer < len(block["options"]):
                    answer = block["options"][answer]
                block["answer"] = str(answer)
                block["explanation"] = str(block.get("explanation") or "")
                
                if block["options"] and block["answer"] not in block["options"]:
                    block["options"].append(block["answer"])
                    
            elif block_type == "summary":
                points = block.get("points")
                if points is None:
                    block["points"] = []
                elif isinstance(points, list):
                    block["points"] = [str(x) for x in points if x is not None]
                else:
                    block["points"] = [str(points)]
                    
            elif block_type == "reference":
                block["title"] = str(block.get("title") or "")
                block["url"] = str(block.get("url") or "")

        # Validate using Pydantic model
        try:
            validated_data = LessonBlocksResponse(**lesson_data)
            return validated_data
        except Exception as pydantic_err:
            logger.error(f"Pydantic validation failed for lesson {req.title}. Error: {pydantic_err}")
            logger.debug(f"Raw content: {response.choices[0].message.content}")
            raise pydantic_err
            
    except Exception as e:
        logger.exception("Error generating lesson blocks")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice")
async def generate_voice(payload: Dict[str, str]):
    lesson_text = payload.get("lesson_text", "")
    if not lesson_text:
        return VoiceScriptResponse(voice_script="").dict()
        
    try:
        # Just generate a streamlined narration script via LLM
        prompt = f"Convert the following textbook explanation into a conversational, engaging voice-over script, suitable for text-to-speech. Do not include sound cues or stage directions or character names. Just the raw spoken text.\nText:\n{lesson_text[:3000]}"
        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        script = response.choices[0].message.content.strip()
        return VoiceScriptResponse(voice_script=script).dict()
    except Exception as e:
        print("Voice error", e)
        return VoiceScriptResponse(voice_script=f"Voice Generation Error: {str(e)}").dict()

@router.post("/image-prompt")
async def generate_image_prompt(payload: Dict[str, str]):
    lesson_text = payload.get("lesson_text", "")
    if not lesson_text:
        return ImagePromptResponse(prompt="Abstract educational background pattern").dict()
        
    prompt = f"Create a vivid, highly descriptive DALL-E image prompt that visually explains this topic. Keep the prompt strictly visual. Topic: {lesson_text[:1000]}"
    try:
         response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
         )
         result = response.choices[0].message.content.strip()
         return ImagePromptResponse(prompt=result).dict()
    except Exception as e:
         return ImagePromptResponse(prompt="Educational visual showing the learning concept.").dict()

@router.post("/image")
async def generate_image(payload: Dict[str, str]):
    prompt = payload.get("prompt", "")
    url = None
    try:
        response = get_openai_client().images.generate(
            model="gpt-image-2",
            prompt=prompt[:1000] if prompt else "Beautiful futuristic educational digital art.",
            n=1,
            size="1024x1024",
            quality="low"
        )
        print("Image response:", response)
        img_data = None
        first_item = response.data[0]
        
        url_val = getattr(first_item, 'url', None)
        b64_val = getattr(first_item, 'b64_json', None)
        
        if b64_val:
            import base64
            img_data = base64.b64decode(b64_val)
        elif url_val and url_val != "None":
            import requests
            img_data = requests.get(url_val, timeout=20).content
        else:
            raise ValueError(f"No valid image URL or b64_json found in response: {first_item}")

        unique_filename = f"dalle_{uuid.uuid4().hex[:8]}.png"
        os.makedirs("uploads", exist_ok=True)
        file_path = os.path.join("uploads", unique_filename)
        with open(file_path, "wb") as f:
            f.write(img_data)
            
        # Return an absolute URL; the frontend will use this directly
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        image_url = f"{base_url}/uploads/{unique_filename}"
        return ImageResponse(image_url=image_url).dict()
    except Exception as e:
        print("Image generation/download error:", e)
        # Return null image URL to indicate omission without placeholder
        return ImageResponse(image_url=None).dict()

@router.post("/quiz")
async def create_course_quiz(req: QuizRequest):
    from content_generator import generate_course_quiz

    try:
        quiz = generate_course_quiz(
            course_title=req.course_title,
            modules=req.modules,
            source_type=req.sourceType,
            audience=req.audience,
            difficulty=req.difficulty,
            objectives=req.objectives or []
        )
        return quiz
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

