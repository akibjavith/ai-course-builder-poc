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
        import re
        course_title = req.course_details.courseName if req.course_details else "the course"
        course_desc = req.course_details.description if req.course_details else ""
        subject = req.course_details.subject if req.course_details else "General"
        difficulty = req.course_details.level if req.course_details else "beginner"
        objectives = req.course_details.requirements if req.course_details else ""

        # ── Duration / Learning Hours Resolution ────────────────────────────────
        # Priority:
        #   1. learningHours  (Normal flow — dedicated instructional-hours field)
        #   2. duration       (Chatbot flow — stores hours in this field)
        #   3. Default 10
        # This shared logic ensures both flows use the same content-scaling endpoint
        # without duplication.
        duration_hours = 10
        logger.info(f"[LessonBlocks] req.course_details: {req.course_details}")

        if req.course_details:
            raw_hours = req.course_details.learningHours or req.course_details.duration or ""
            logger.info(f"[LessonBlocks] raw learning-hours string: '{raw_hours}'")
            match = re.search(r'\d+', str(raw_hours))
            if match:
                duration_hours = int(match.group())

        # Clamp to supported range 1–20
        duration_hours = max(1, min(duration_hours, 20))
        logger.info(f"[LessonBlocks] resolved duration_hours: {duration_hours}")

        # ── Per-hour granular token budget and dynamic system rules ───────────────
        # Formula: 3650 base tokens for 1h, scaling +480 tokens per additional hour up to 12,800 tokens for 20h
        initial_max_tokens = min(12800, 3650 + (duration_hours - 1) * 480)
        max_tokens_for_tier = initial_max_tokens

        system_size_rules = (
            f"COURSE DEPTH LAW — {duration_hours}-HOUR COURSE: "
            f"This lesson is designed for a {duration_hours}-hour course level. Write high-quality, comprehensive textbook material "
            "proportional to this course depth. You are FORBIDDEN from writing superficial summaries or placeholder text. "
            "Organically select and mix the best content blocks (code, tables, lists, callouts, paragraphs, sub-paragraphs, quizzes, flashcards, assignments) "
            "that best fit this specific topic without forcing artificial word-count padding."
        )

        logger.info(f"[LessonBlocks] duration: {duration_hours}h | initial_max_tokens: {initial_max_tokens}")

        duration_guidelines = f"""
        COURSE DEPTH: {duration_hours}-HOUR COURSE.
        - Tailor the richness, depth of explanation, number of worked examples, and exercise blocks proportionally for a {duration_hours}-hour learning experience.
        - Write direct, learner-ready textbook content—no teacher guidelines or placeholder text.
        """

        # Extract style to adapt content block priorities while maintaining rich block diversity
        style_lower = str(objectives).lower()
        style_guidelines = ""
        if "coding" in style_lower or "programming" in style_lower or "code" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Hands-on Coding'.
        - Prioritize functional "code" blocks with thorough line-by-line explanations alongside supporting "paragraph", "callout", and "example" blocks.
        """
        elif "explain" in style_lower or "text" in style_lower or "detailed" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Detailed Explanations'.
        - Prioritize thorough "paragraph" textbook blocks, "callout" notes, and "example" case studies.
        """
        elif "quiz" in style_lower or "question" in style_lower or "check" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Interactive Quizzes'.
        - Include self-assessment "quiz" and "flashcard" blocks alongside explanatory paragraph context. Put ALL quiz questions for this lesson into a single "quiz" block's "questions" list (do not create multiple separate quiz blocks); similarly put all flashcards into a single "flashcard" block's "cards" list.
        """
        elif "table" in style_lower or "structure" in style_lower or "chart" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Structured Tables'.
        - Prioritize data-rich "table" blocks (comparison matrices, feature breakdowns) alongside explanatory paragraphs.
        """
        elif "image" in style_lower or "visual" in style_lower or "diagram" in style_lower or "infographic" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Visual Diagrams & Infographics'.
        - Include "image" blocks with descriptive captions alongside explanatory text and summary points.
        """
        elif "video" in style_lower or "lecture" in style_lower or "multimedia" in style_lower or "narration" in style_lower:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Video & Multimedia Lectures'.
        - Include "video" blocks with narration breakdowns alongside explanatory text and summary blocks.
        """
        else:
            style_guidelines = """
        PRIMARY LEARNING STYLE PREFERENCE: 'Balanced Combination'.
        - Combine explanatory "paragraph" text, "callout" tips, "table" breakdowns, "code" snippets (if applicable), "quiz" questions, and "flashcard" blocks into a rich learning flow.
        """

        prompt_str = f"""
        Generate structured block-based educational content for the lesson '{req.title}' in the module '{req.module_title}' for the course '{course_title}'.
        Course Description: {course_desc}
        Subject: {subject}
        Difficulty: {difficulty}
        Audience/Style: {objectives}
        
        {duration_guidelines}
        {style_guidelines}
        
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
        2. "paragraph": text. Write clear, thorough, learner-ready content. Use sub-paragraphs or multiple paragraph blocks as needed.
        3. "bullet_list": items (list of strings).
        4. "numbered_list": items (list of strings).
        5. "image": url (always output "" for now), caption (describe what the visual should represent).
        6. "video": url (always output "" for now), caption (describe what the video/narration should show).
        7. "table": headers (list of strings), rows (list of lists of strings). Used for comparisons, classifications, and vocabulary guides.
        8. "callout": text, callout_type (one of: "info", "warning", "tip", "danger").
        9. "code": language, code, explanation. Write actual functional code without markdown backticks inside the code field.
        10. "example": scenario, detail. Real-world scenario case study, math calculation, or code walk-through. Must contain the complete scenario and result.
        11. "quiz": title (optional string), objective (optional string), questions — a list of objects, each with question, options (list of strings), correctAnswer (the exact string from options), explanation. Include ALL quiz questions for this lesson as multiple entries in this single "questions" list — do NOT create more than one "quiz" block per lesson. Make sure each question is actual learner assessment, not placeholder text.
        12. "assignment": task, instructions, grading_criteria (list of strings). Write actual tasks the student can work on.
        13. "flashcard": title (optional string), cards (list of objects with "front" and "back" strings). Front contains key term/concept/question, Back contains definition/explanation/answer. Include ALL flashcards for this lesson as multiple entries in this single "cards" list — do NOT create more than one "flashcard" block per lesson.
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
                {{
                    "type": "quiz",
                    "title": "...",
                    "objective": "...",
                    "questions": [
                        {{ "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": "...", "explanation": "..." }},
                        {{ "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": "...", "explanation": "..." }}
                    ]
                }},
                {{
                    "type": "flashcard",
                    "title": "...",
                    "cards": [
                        {{ "front": "...", "back": "..." }},
                        {{ "front": "...", "back": "..." }}
                    ]
                }},
                ...
            ]
        }}
        Notice above: ALL quiz questions live inside ONE "quiz" block's "questions" list, and ALL flashcards live inside ONE "flashcard" block's "cards" list — never split them into multiple separate "quiz" or "flashcard" blocks.
        """

        # Build dynamic system prompt: base identity + tier-specific size law
        system_content = (
            "You are a world-class educational textbook author. "
            "Your goal is to write highly detailed, comprehensive, in-depth, and exhaustive textbook material. "
            "You write extremely thorough and complete lessons. Never summarize or omit details. "
            "Output JSON only.\n\n"
            f"{system_size_rules}"
        )

        # OpenAI's hard output-token ceiling for this model — never request above this
        MODEL_MAX_COMPLETION_TOKENS = 16384

        # ── Attempt generation, retrying once with a larger token budget if the
        # first response gets truncated and cannot be repaired into valid JSON ──
        attempt_token_budgets = [max_tokens_for_tier]
        retry_budget = min(MODEL_MAX_COMPLETION_TOKENS, max_tokens_for_tier + 4000)
        if retry_budget > max_tokens_for_tier:
            attempt_token_budgets.append(retry_budget)

        lesson_data = None
        for attempt_idx, tokens_for_attempt in enumerate(attempt_token_budgets):
            is_retry = attempt_idx > 0
            if is_retry:
                logger.warning(
                    f"[LessonBlocks] Retrying generation for lesson '{req.title}' with a larger token "
                    f"budget ({tokens_for_attempt}) after truncated/unrepairable response."
                )

            response = get_openai_client().chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": system_content
                    },
                    {"role": "user", "content": prompt_str}
                ],
                temperature=0.7,
                max_tokens=tokens_for_attempt,
                response_format={"type": "json_object"}
            )

            if req.draft_id:
                try:
                    from metering_helper import track_chatbot_cost
                    step_name = f"generate_lesson_{req.title}" + ("_retry" if is_retry else "")
                    track_chatbot_cost(req.draft_id, response, "gpt-4o-mini", step_name)
                except Exception as ex:
                    logger.error(f"Failed to track lesson blocks generation cost: {ex}")

            # ── Safe JSON parse with finish_reason check and repair fallback ─────
            raw_content = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason

            if finish_reason == "length":
                logger.warning(
                    f"[LessonBlocks] Response was TRUNCATED (finish_reason=length) for lesson '{req.title}'. "
                    f"Attempting JSON repair. tier={duration_hours}h, max_tokens={tokens_for_attempt}"
                )

            try:
                lesson_data = json.loads(raw_content)
                break
            except json.JSONDecodeError as parse_err:
                logger.warning(f"[LessonBlocks] Initial json.loads failed: {parse_err}. Attempting repair...")
                try:
                    from chat_service import try_repair_truncated_json
                    repaired = try_repair_truncated_json(raw_content)
                    lesson_data = json.loads(repaired)
                    logger.info(f"[LessonBlocks] JSON repair succeeded for lesson '{req.title}'.")
                    break
                except Exception as repair_err:
                    logger.error(
                        f"[LessonBlocks] JSON repair also failed for lesson '{req.title}' "
                        f"(attempt {attempt_idx + 1}/{len(attempt_token_budgets)}): {repair_err}."
                    )
                    lesson_data = None

        if lesson_data is None:
            logger.error(
                f"[LessonBlocks] All generation attempts failed for lesson '{req.title}'. "
                "Returning placeholder lesson to avoid 500 crash."
            )
            # Return a safe fallback — partial lesson is better than a total 500 failure
            lesson_data = {
                "title": req.title,
                "blocks": [{
                    "type": "callout",
                    "text": "Content generation was interrupted. Please regenerate this lesson.",
                    "callout_type": "warning"
                }]
            }
        
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
                    "knowledgecheck": "quiz",
                    "knowledge-check": "quiz",
                    "flashcards": "flashcard",
                    "flashcard_block": "flashcard",
                    "flash_card": "flashcard",
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
                elif "correctAnswer" in block or "answer" in block:
                    block["type"] = "quiz"
                elif "task" in block or "grading_criteria" in block:
                    block["type"] = "assignment"
                elif "cards" in block or "flashcard" in block:
                    block["type"] = "flashcard"
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
                "flashcard", "summary", "reference"
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
                block["title"] = str(block.get("title") or "Knowledge Check & Assessment")
                block["objective"] = str(block.get("objective") or "Work through mixed question types in one quiz set. Each question scores independently.")
                
                # Check for multi-question vs single question format
                raw_questions = block.get("questions")
                normalized_questions = []
                if isinstance(raw_questions, list) and len(raw_questions) > 0:
                    for q in raw_questions:
                        if isinstance(q, dict):
                            q_text = str(q.get("question") or "")
                            q_opts = q.get("options") or []
                            if not isinstance(q_opts, list):
                                q_opts = [str(q_opts)]
                            else:
                                q_opts = [str(x) for x in q_opts if x is not None]
                            q_ans = str(q.get("correctAnswer") or q.get("answer") or "")
                            if isinstance(q.get("correctAnswer"), int) and 0 <= q.get("correctAnswer") < len(q_opts):
                                q_ans = q_opts[q.get("correctAnswer")]
                            q_exp = str(q.get("explanation") or "")
                            q_type = str(q.get("question_type") or "SINGLE CHOICE")
                            if q_text:
                                normalized_questions.append({
                                    "question": q_text,
                                    "options": q_opts,
                                    "correctAnswer": q_ans,
                                    "explanation": q_exp,
                                    "question_type": q_type
                                })
                
                # Fallback to single question format if questions array is empty
                if not normalized_questions:
                    single_q = str(block.get("question") or "")
                    options = block.get("options")
                    if options is None:
                        options = []
                    elif isinstance(options, list):
                        options = [str(x) for x in options if x is not None]
                    else:
                        options = [str(options)]
                    correct_answer = str(block.get("correctAnswer") or block.get("answer") or "")
                    explanation = str(block.get("explanation") or "")
                    if single_q or options:
                        normalized_questions.append({
                            "question": single_q or "Assess your understanding:",
                            "options": options,
                            "correctAnswer": correct_answer,
                            "explanation": explanation,
                            "question_type": "SINGLE CHOICE"
                        })
                
                if not normalized_questions:
                    normalized_questions = [{
                        "question": "Sample Question",
                        "options": ["Option A", "Option B"],
                        "correctAnswer": "Option A",
                        "explanation": "Explanation text.",
                        "question_type": "SINGLE CHOICE"
                    }]

                block["questions"] = normalized_questions
                # Keep top-level single question fields synchronized for legacy support
                first_q = normalized_questions[0]
                block["question"] = first_q["question"]
                block["options"] = first_q["options"]
                block["correctAnswer"] = first_q["correctAnswer"]
                block["explanation"] = first_q["explanation"]
                
                q_count = len(normalized_questions)
                block["estimated_time"] = str(block.get("estimated_time") or f"~{max(1, q_count * 2)} min")
                    
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
                    
            elif block_type == "flashcard":
                block["title"] = str(block.get("title") or "Key Terminology & Flashcards")
                raw_cards = block.get("cards")
                normalized_cards = []
                if isinstance(raw_cards, list):
                    for item in raw_cards:
                        if isinstance(item, dict):
                            front = str(item.get("front") or item.get("question") or item.get("term") or "")
                            back = str(item.get("back") or item.get("answer") or item.get("definition") or item.get("explanation") or "")
                            if front or back:
                                normalized_cards.append({"front": front, "back": back})
                        elif isinstance(item, str):
                            normalized_cards.append({"front": item, "back": ""})
                if not normalized_cards:
                    normalized_cards = [
                        {"front": "Key Term 1", "back": "Definition of key term 1."},
                        {"front": "Key Term 2", "back": "Definition of key term 2."}
                    ]
                block["cards"] = normalized_cards
                    
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

