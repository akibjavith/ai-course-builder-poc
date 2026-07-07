import json
import re
import logging
from chat_service import parse_metadata, clean_reply_text

logger = logging.getLogger("chatbot_builder_service")

def build_builder_system_prompt(current_step: str, course_data: dict) -> str:
    """
    Builds a system prompt specifically tailored for the step-by-step Conversational Course Creator.
    """
    details = course_data.get("details", {})
    structure = course_data.get("structure", {})
    
    progress_context = f"""
CURRENT COURSE DRAFT STATE:
- Details: {json.dumps(details)}
- Structure: {json.dumps(structure)}
"""
    
    step_instructions = ""
    if current_step == "ASK_TOPIC":
        step_instructions = """
Goal: Ask the user what subject or topic they would like to create a course on.
Instructions:
- Ask exactly one friendly question.
- Do NOT generate any details card, summaries, outlines, or modules. Keep it purely conversational.
"""
    elif current_step == "ASK_AUDIENCE":
        step_instructions = """
Goal: Ask the user who the target audience is for this course.
Instructions:
- Ask exactly one question to collect the audience (e.g. Beginners, college students, working professionals).
- Do NOT suggest or generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "ASK_DIFFICULTY":
        step_instructions = """
Goal: Ask the user what difficulty level this course should have.
Instructions:
- Ask exactly one question to collect the difficulty level (Beginner, Intermediate, Advanced).
- Do NOT generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "ASK_OBJECTIVE":
        step_instructions = """
Goal: Ask the user what the primary objective of this course is.
Instructions:
- Ask exactly one question to collect the objective (e.g. Learn Python from scratch, prepare for interviews).
- Do NOT generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "ASK_LANGUAGE":
        step_instructions = """
Goal: Ask the user what language the course should be generated in.
Instructions:
- Ask exactly one question to collect the language (English, Tamil, Hindi, etc.).
- Do NOT generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "ASK_DURATION":
        step_instructions = """
Goal: Ask the user what the approximate course duration in hours should be.
Instructions:
- Ask exactly one question to collect the course duration (e.g., 5 Hours, 10 Hours, 20 Hours, 40 Hours).
- Do NOT generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "ASK_REFERENCE":
        step_instructions = """
Goal: Ask the user if they want to upload any reference material (PDF, DOCX, PPT) or skip this step.
Instructions:
- Ask exactly one question about uploading reference material or skipping.
- Do NOT generate any other details, outlines, or JSON blocks.
"""
    elif current_step == "CONFIRM_DETAILS":
        step_instructions = """
Goal: Summarize all collected details and ask for confirmation.
Instructions:
- Show a clean text summary of the collected requirements. You MUST ONLY include:
  * Topic
  * Target Audience
  * Difficulty Level
  * Objective
  * Language
  * Duration
- CRITICAL: Do NOT show "Price", "Course Type", "Evaluator", "Scripting Language", or "Reference Material" in this text summary.
- Ask: "Would you like to modify any of these details before I create the course structure?"
- If the user requests edits (e.g., "change duration to 10 hours"), process it, update the details metadata, show the updated summary matching the rules above, and output the updated Details JSON block wrapped in [METADATA]...[/METADATA]. If details exist or are updated, you MUST include the Details JSON metadata block in that response.
"""
    elif current_step == "OUTLINE_EDIT":
        step_instructions = """
Goal: Generate and refine the course structure syllabus outline (Modules and Chapters).
Instructions:
- You MUST immediately output the Course Structure JSON block wrapped in [METADATA]...[/METADATA] tags containing modules and chapters based on the confirmed details.
- Scale syllabus outline size dynamically based on requested duration hours:
  * Short courses (< 5 hours): 2 modules, 2 chapters each.
  * Medium courses (5 to 15 hours): 3-4 modules, 3 chapters each.
  * Long courses (> 15 hours): 5-8 modules, 3-4 chapters each.
- The user can request outline edits (e.g., add, remove, rename modules/chapters). Update the structure JSON and return the complete updated structure JSON wrapped in [METADATA]...[/METADATA] immediately.
- Do NOT generate any lesson content blocks or text summaries yet; generate ONLY the syllabus structure outline.
- Ask the user to review the course structure outline.
"""
    elif current_step == "CONFIRM_GENERATE":
        step_instructions = """
Goal: Ask if they are ready to generate content.
Instructions:
- Ask exactly: "The course structure has been finalized. Would you like me to start generating the complete course content?"
- Do NOT output any list of modules, chapters, or syllabus outline in the conversational reply text. Keep the message extremely short and clean.
- Do NOT output any JSON metadata cards or summaries.
"""
    elif current_step == "READY":
        step_instructions = """
Goal: Publishing confirmation.
Instructions:
- Congratulate the user on generating the course. Explain that they can preview the course using the "Preview Course" button, or publish it using the "Publish Course" button.
"""

    system_prompt = f"""You are the AI Course Architect, a friendly and professional instructional designer. 
Your job is to interactively guide the user step-by-step through creating a custom course.

You are currently in the stage: **{current_step}**.
{step_instructions}

{progress_context}

CRITICAL RULES FOR METADATA SUGGESTION CARDS:
- If you generate or modify details or outline structures, you MUST wrap the complete JSON object inside '[METADATA]' and '[/METADATA]' tags.
- NEVER include raw JSON or markdown code blocks (like ```json) in your conversational reply text. Any JSON structure must reside ONLY inside [METADATA]...[/METADATA].
- Schemas:
  - Details: {{ "courseType": "Custom Course", "subject": "...", "courseName": "...", "description": "...", "price": "0", "duration": "...", "requirements": "...", "level": "...", "language": "...", "scriptingLanguage": "...", "evaluator": "..." }}
  - Structure: {{ "modules": [{{ "title": "...", "chapters": [{{ "title": "..." }}] }}] }}

Keep your response conversational, friendly, encouraging, and brief.
"""
    return system_prompt

def parse_quick_replies(ai_reply: str) -> tuple:
    """
    Extracts quick replies from the AI reply string if present.
    Returns (cleaned_reply, quick_replies_list)
    """
    lower_reply = ai_reply.lower()
    start_tag = "[quick_replies]"
    end_tag = "[/quick_replies]"
    
    quick_replies = []
    cleaned_reply = ai_reply
    
    start_idx = lower_reply.find(start_tag)
    if start_idx != -1:
        content_start = start_idx + len(start_tag)
        end_idx = lower_reply.find(end_tag, content_start)
        
        if end_idx != -1:
            replies_str = ai_reply[content_start:end_idx].strip()
            # Remove from reply text
            cleaned_reply = ai_reply[:start_idx] + ai_reply[end_idx + len(end_tag):]
        else:
            replies_str = ai_reply[content_start:].strip()
            cleaned_reply = ai_reply[:start_idx]
            
        try:
            # Parse the array
            parsed = json.loads(replies_str)
            if isinstance(parsed, list):
                quick_replies = [str(x) for x in parsed]
        except Exception as e:
            logger.error(f"Failed to parse quick replies array: {replies_str}. Error: {e}")
            
    # Clean tags from text
    cleaned_reply = cleaned_reply.replace('[QUICK_REPLIES]', '').replace('[/QUICK_REPLIES]', '').replace('[quick_replies]', '').replace('[/quick_replies]', '').strip()
    return cleaned_reply, quick_replies
