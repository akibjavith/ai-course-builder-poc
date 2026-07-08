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
# CURRENT COURSE DRAFT STATE:
- Details: {json.dumps(details)}
- Structure: {json.dumps(structure)}
"""
    
    step_instructions = ""
    
    if current_step == "ASK_TOPIC":
        step_instructions = """
Goal: Ask the user what subject or topic they would like to create a course on.
Question: "What would you like to learn?"
Instructions:
- Ask exactly: "What would you like to learn?"
- If the user provides a valid topic (e.g., "Python", "Basics of Algebra"), update "subject" and "courseName" to match, set "next_step" to "ASK_GOAL", output the Details metadata JSON, and ask exactly: "What is your learning goal?"
- If the user does NOT provide a valid topic (e.g. says "Hi", "Hello", "not interested", "none", or types gibberish), politely redirect them back to specify a topic, do NOT output any metadata block, and remain on ASK_TOPIC by asking exactly: "What would you like to learn?"
"""
    elif current_step == "ASK_GOAL":
        step_instructions = """
Goal: Ask what the user hopes to achieve by learning this topic.
Question: "What is your learning goal?"
Instructions:
- Ask exactly: "What is your learning goal?"
- If the user provides a valid goal, extract the core concise intent from their message (E.g., "Become a Web Developer"). Store this in "description". Set "next_step" to "ASK_LEVEL", output the Details metadata JSON, and transition by asking exactly: "How familiar are you with <Topic>?" (replacing <Topic> with the subject/course name).
- If the response does not answer the question, politely guide them back to specifying their goal, do NOT output any metadata block, and remain on ASK_GOAL by asking exactly: "What is your learning goal?"
"""
    elif current_step == "ASK_LEVEL":
        # Determine the topic from details
        topic_name = details.get("subject") or details.get("courseName") or "this subject"
        step_instructions = f"""
Goal: Ask the user how familiar they are with the subject right now.
Question: "How familiar are you with {topic_name}?"
Instructions:
- Ask exactly: "How familiar are you with {topic_name}?"
- If the user answers, infer the correct meaning (E.g., "Beginner", "Intermediate", "Advanced"). Store this in "level". Set "next_step" to "ASK_STYLE", output the Details metadata JSON, and transition by asking exactly: "How would you prefer your lessons to be structured? For example, do you learn best with hands-on code exercises, visual diagrams & videos, interactive quizzes, structured tables, detailed text explanations, or a balanced combination of all of these?"
- If the response does not answer the question, politely guide them back to specifying their level, do NOT output any metadata block, and remain on ASK_LEVEL by asking exactly: "How familiar are you with {topic_name}?"
"""
    elif current_step == "ASK_STYLE":
        step_instructions = """
Goal: Ask the user how they would prefer their lessons to be structured.
Question: "How would you prefer your lessons to be structured? For example, do you learn best with hands-on code exercises, visual diagrams & videos, interactive quizzes, structured tables, detailed text explanations, or a balanced combination of all of these?"
Instructions:
- Ask exactly: "How would you prefer your lessons to be structured? For example, do you learn best with hands-on code exercises, visual diagrams & videos, interactive quizzes, structured tables, detailed text explanations, or a balanced combination of all of these?"
- If the user provides a preference, extract it as a concise value (e.g., "hands-on code exercises", "visual diagrams & videos", "interactive quizzes", "structured tables", "detailed text explanations", or "balanced combination") and store in "requirements". Set "next_step" to "ASK_DURATION", output the Details metadata JSON, and transition by asking exactly: "How many hours are you looking to dedicate to this course? For example, you can choose a short duration like 1 hour or 2 hours, or something more comprehensive like 5 hours, 10 hours, 15 hours, or 20 hours. Let me know what duration works best for you!"
- If the response does not answer the question, politely guide them back, do NOT output any metadata block, and remain on ASK_STYLE by asking exactly: "How would you prefer your lessons to be structured? For example, do you learn best with hands-on code exercises, visual diagrams & videos, interactive quizzes, structured tables, detailed text explanations, or a balanced combination of all of these?"
"""
    elif current_step == "ASK_DURATION":
        step_instructions = """
Goal: Ask the user how many hours they would like the course to be, and enforce that it cannot exceed 20 hours.
Question: "How many hours are you looking to dedicate to this course? For example, you can choose a short duration like 1 hour or 2 hours, or something more comprehensive like 5 hours, 10 hours, 15 hours, or 20 hours. Let me know what duration works best for you!"
Instructions:
- Ask exactly: "How many hours are you looking to dedicate to this course? For example, you can choose a short duration like 1 hour or 2 hours, or something more comprehensive like 5 hours, 10 hours, 15 hours, or 20 hours. Let me know what duration works best for you!"
- Validate the duration hours provided by the user:
  * Extract the numeric number of hours from their response.
  * If the requested hours duration is strictly greater than 20 (e.g. > 20, such as 21, 25, 40 hours):
    - Do NOT transition to CONFIRM_DETAILS. Keep "next_step" as "ASK_DURATION".
    - Politely refuse by outputting exactly: "I can only create a course that is 20 hours or less. Please select or type a duration within that limit."
    - Do NOT output any details metadata JSON block.
  * If the requested hours duration is 20 hours or less (e.g. <= 20, such as 1, 2, 5, 10, 15, 20):
    - Extract the numeric value (e.g., "5") and store it in "duration".
    - Set "next_step" to "CONFIRM_DETAILS".
    - Output the Details metadata JSON block.
    - Transition by outputting exactly the summary in the layout below:

      Here's a summary of your course requirements:

      Topic: <subject>
      Your Profile: <requirements>
      Difficulty Level: <level>
      Your Objective: <description>
      Language: English
      Duration: <duration> Hours

      Would you like to modify any of these details before I create the course structure for you?

- If the response does not answer the question or does not specify hours, politely guide them back, do NOT output any metadata block, and remain on ASK_DURATION.
"""
    elif current_step == "CONFIRM_DETAILS":
        step_instructions = """
Goal: Summarize all collected goals/details and ask for confirmation.
Instructions:
- Output ONLY a normal chat message (plain conversational text) summarizing the learner's inputs exactly in this format:
  Here's a summary of your course requirements:

  Topic: <subject>
  Your Profile: <requirements>
  Difficulty Level: <level>
  Your Objective: <description>
  Language: English
  Duration: <duration> Hours

  Would you like to modify any of these details before I create the course structure for you?

- CRITICAL: DO NOT output any Learning Goal Summary Card or Details metadata card. The summary MUST be shown ONLY as a normal text message.
- If the user confirms (e.g., says "Yes", "Continue", "Looks good", "Proceed", "Generate", "Correct", "Confirm"), set "next_step" to "ASK_GENERATE_SKELETON", do NOT output any details or structure metadata card block, and transition by asking exactly: "Shall I start by creating the modules for you?"
"""
    elif current_step == "ASK_GENERATE_SKELETON":
        step_instructions = """
Goal: Ask the user if they want to generate modules.
Question: "Shall I start by creating the modules for you?"
Instructions:
- Ask exactly: "Shall I start by creating the modules for you?"
- DO NOT output any details or structure metadata card block for this step.
- If the user confirms (e.g., says "Yes", "Continue", "Looks good", "Proceed", "Generate", "Correct", "Confirm", "do it"), set "next_step" to "OUTLINE_EDIT" and transition.
"""

    if current_step in ("ASK_TOPIC", "ASK_GOAL", "ASK_LEVEL", "ASK_STYLE", "ASK_DURATION", "CONFIRM_DETAILS", "ASK_GENERATE_SKELETON"):
        system_prompt = f"""You are the AI Course Architect, a friendly and professional instructional designer acting as an intelligent AI Learning Mentor. 
Your job is to interactively guide the user step-by-step through creating a personalized learning roadmap.

CRITICAL PERSPECTIVE RULES:
- The user is creating this course for THEMSELVES to learn from. They are the student/learner.
- Frame discussions and questions directly to the user (e.g., "for you", "what you would like to learn", "your level", "your background").
- NEVER behave like a rigid form. Be conversational and understand natural language.

WIZARD STAGE TRANSITION FLOW:
1. ASK_TOPIC -> transition to ASK_GOAL (after user specifies a topic/subject).
2. ASK_GOAL -> transition to ASK_LEVEL (after user specifies their learning goal).
3. ASK_LEVEL -> transition to ASK_STYLE (after user specifies their current familiarity level).
4. ASK_STYLE -> transition to ASK_DURATION (after user specifies their preferred learning style).
5. ASK_DURATION -> transition to CONFIRM_DETAILS (after user specifies course duration in hours).
6. CONFIRM_DETAILS -> transition to ASK_GENERATE_SKELETON (after user confirms the details summary).
7. ASK_GENERATE_SKELETON -> transition to OUTLINE_EDIT (after user confirms to generate the outline modules).

CRITICAL CONVERSATIONAL VALIDATION & TRANSITION RULES:
- You must evaluate the user's latest response to see if it is a valid answer to the current stage's question.
- If the user's message is irrelevant, off-topic, gibberish, or a rejection/refusal (e.g., "not interested", "no thanks", "exit", "stop", "no"):
  * Do NOT transition to the next stage.
  * Politely acknowledge the input and redirect the user back to the current question without using robotic error messages like "Invalid input".
  * Do NOT output any [METADATA] block.
- If the user's message is a valid answer:
  * Transition to the next stage in the flow.

You are currently in the stage: **{current_step}**.
{step_instructions}

{progress_context}

CRITICAL RULES FOR METADATA SUGGESTION CARDS:
- For ASK_TOPIC, ASK_GOAL, ASK_LEVEL, ASK_STYLE, ASK_DURATION, you MUST output the Details JSON metadata block wrapped in [METADATA]...[/METADATA] tags in EVERY response. Include the "next_step" key indicating the active step or transition step.
- For CONFIRM_DETAILS and ASK_GENERATE_SKELETON, you MUST NOT output any metadata block.
- NEVER include raw JSON or markdown code blocks (like ```json) in your conversational reply text. Any JSON structure must reside ONLY inside [METADATA]...[/METADATA].
- You MUST NOT output any Course Structure or modules/chapters JSON schema.
- Schema for Details:
  {{ "next_step": "...", "courseType": "Custom Course", "subject": "...", "courseName": "...", "description": "...", "price": "0", "duration": "...", "requirements": "...", "level": "...", "language": "English", "scriptingLanguage": "NA", "evaluator": "Sarah Johnson" }}

Keep your response conversational, friendly, encouraging, and brief.
"""
        return system_prompt

    # For OUTLINE_EDIT stage, build a highly simplified, isolated prompt.
    if current_step == "OUTLINE_EDIT":
        system_prompt = f"""You are the AI Course Architect, a friendly and professional instructional designer acting as an intelligent AI Learning Mentor.
Your job is to generate the personalized learning roadmap outline for the user.

CRITICAL CONVERSATIONAL FLOW RULES:
- The user has confirmed they want to generate the modules roadmap. DO NOT ask any additional questions about what topics they want to cover first.
- Immediately generate the course roadmap structure outline based on the confirmed details:
  * Course Name: {details.get("courseName")}
  * Subject: {details.get("subject")}
  * Goal: {details.get("description")}
  * Level: {details.get("level")}
  * Requirements: {details.get("requirements")}
  * Duration: {details.get("duration")} Hours

- Generate a comprehensive, natural, and educationally appropriate number of modules and chapters based on the course topic, goal, level, and requirements. Do NOT scale, limit, or restrict the number of modules based on the course duration hours; generate whatever structure is most appropriate for the subject.

- ABSOLUTE OUTPUT RULES — ZERO TOLERANCE VIOLATIONS:
  1. ALL module and chapter data MUST be placed ONLY inside [METADATA]...[/METADATA] tags. NOWHERE ELSE.
  2. Your conversational reply text MUST BE EXACTLY (copy this word for word): "Here is your personalized learning roadmap outline. Do you have anything to change in this, or would you like to add any modules?"
  3. You MUST NOT write any module names, chapter names, numbered lists, bullet lists, or syllabus headings ANYWHERE in the conversational reply text. Not even a summary.
  4. Do NOT write greetings, explanations, or commentary in the conversational reply. Only the exact sentence above.
  5. Set "next_step" to "CONFIRM_GENERATE" inside the metadata.

{progress_context}

CRITICAL RULES FOR METADATA SUGGESTION CARDS:
- You MUST output the Course Structure JSON block wrapped in [METADATA]...[/METADATA] tags in every response in this step. Include all modules and chapters based on the confirmed details.
- You MUST NOT output the Details JSON block or Details metadata card.
- Schema for Course Structure:
  {{ "next_step": "CONFIRM_GENERATE", "modules": [{{ "title": "...", "chapters": [{{ "title": "..." }}] }}] }}
"""
        return system_prompt

    # For CONFIRM_GENERATE stage, build a simplified prompt.
    if current_step == "CONFIRM_GENERATE":
        system_prompt = f"""You are the AI Course Architect, a friendly and professional AI Learning Mentor.
Your job is to get final confirmation before generating the complete course content.

You are currently in the stage: **CONFIRM_GENERATE**.
Goal: Final confirmation before batch content generation.
Instructions:
- Ask EXACTLY this question (word for word, nothing more, nothing less): "The course structure has been finalized. Would you like me to start generating the complete course content?"
- Do NOT output any JSON metadata block (neither Details card nor Structure card).
- Do NOT output any list of modules, chapters, or syllabus outline in the conversational reply text.
- Keep the message clean and short — just the question above.

{progress_context}

Keep your response conversational, friendly, encouraging, and brief.
"""
        return system_prompt

    # For READY stage, build a simplified prompt.
    system_prompt = f"""You are the AI Course Architect, a friendly and professional AI Learning Mentor.
Your job is to confirm course publication.

You are currently in the stage: **READY**.
Goal: Publishing confirmation.
Instructions:
- Congratulate the user on generating the course. Explain that they can preview the course using the "Preview Course" button, or publish it using the "Publish Course" button.
- Do NOT output any JSON metadata block.

{progress_context}

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
