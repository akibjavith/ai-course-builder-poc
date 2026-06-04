from fastapi import APIRouter, HTTPException
import asyncio
from pydantic import BaseModel, Field
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

        You MUST structure your response as a list of distinct content blocks. Choose the best dynamic sequence of blocks that fits this topic. Do not just use one block type; create a rich learning flow.
        
        The allowed block types and their exact structure/rules are:
        1. "heading": level (1, 2, or 3), text. Use this for outline and sub-topics.
        2. "paragraph": text. CRITICAL: Every paragraph block MUST be a deep-dive, comprehensive, and highly detailed explanation containing between 150 to 250 words. Do not write short paragraphs.
        3. "bullet_list": items (list of strings). Must contain at least 3-5 distinct points.
        4. "numbered_list": items (list of strings). Must contain at least 3-5 sequential steps or items.
        5. "image": url (always output "" for now), caption (describe what the visual should represent).
        6. "video": url (always output "" for now), caption (describe what the video/narration should show).
        7. "table": headers (list of strings), rows (list of lists of strings). Used for comparisons, classifications, etc.
        8. "callout": text, callout_type (one of: "info", "warning", "tip", "danger").
        9. "code": language, code, explanation. Write actual functional code without markdown backticks inside the code field.
        10. "example": scenario, detail. Real-world scenario case study.
        11. "quiz": question, options (list of strings), correctAnswer (the exact string from options), explanation.
        12. "assignment": task, instructions, grading_criteria (list of strings).
        13. "knowledge_check": question, options (list of strings), answer (the exact string from options), explanation.
        14. "summary": points (list of strings summarizing key takeaways).
        15. "reference": title, url (trusted educational platforms/documentation, no hallucinated URLs).

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
        # Validate using Pydantic model
        validated_data = LessonBlocksResponse(**lesson_data)
        return validated_data
        
    except Exception as e:
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

