import json
import re
import logging
from chat_service import parse_metadata, clean_reply_text

logger = logging.getLogger("chatbot_builder_service")

def build_builder_system_prompt(current_step: str, course_data: dict) -> str:
    """
    Builds a system prompt specifically tailored for the Conversational Chatbot Course Creator.
    """
    details = course_data.get("details", {})
    structure = course_data.get("structure", {})
    modules = structure.get("modules", [])
    
    # Format current progress context for the LLM
    progress_context = f"""
CURRENT COURSE DRAFT STATE:
- Details: {json.dumps(details)}
- Structure (Modules/Chapters count): {len(modules)} modules defined.
"""
    
    step_instructions = ""
    if current_step == "GATHER_DETAILS":
        step_instructions = """
Goal: Gather course details (name, description, subject, difficulty level, duration, requirements/audience, language, and scriptingLanguage).
Instructions:
- Ask the user friendly questions to gather these details.
- Proactively suggest details (name, description, level, duration) based on a simple topic keyword (e.g. if they say "Python", propose a complete details card immediately!).
- When updating or proposing details, output a Course Details JSON block wrapped in [METADATA]...[/METADATA] tags.
- Keep the conversational reply text above the details suggestion card extremely short and brief (exactly a single sentence, e.g. "Here are the suggested course details for your topic:"). Do not add any conversational filler or lists before the card.
- Provide dynamic [QUICK_REPLIES] to help them select fields like level ("beginner", "intermediate", "advanced"), duration ("7 days", "14 days", "30 days"), or to accept your suggestions ("Confirm Details", "Change Name").
"""
    elif current_step == "OUTLINE_EDIT":
        step_instructions = """
Goal: Establish and refine the course structure (Modules and Chapters).
Instructions:
- If details are ready but structure is empty, immediately suggest a detailed course structure (modules and chapters) appropriate for the course level and topic.
- Show the outline to the user and ask if they like it or want to add/remove modules or chapters.
- If they ask for modifications, apply them and return the updated structure.
- Always output the updated Course Structure JSON block wrapped in [METADATA]...[/METADATA] tags when proposing or modifying it.
- Provide [QUICK_REPLIES] like: ["Looks Good, Confirm Outline!", "Add a module", "Make it shorter"].
"""
    elif current_step == "CONTENT_GEN":
        step_instructions = """
Goal: Generate high-quality lesson content prompts for the chapters.
Instructions:
- Instruct the user that we are setting up lesson content prompts for each chapter.
- You can generate all content prompts at once or chapter by chapter.
- When generating prompts, you must output them wrapped in [METADATA]...[/METADATA] using the schema.
- Provide [QUICK_REPLIES] like: ["Generate All Chapter Prompts", "Customize Lesson 1", "Proceed to Quizzes"].
"""
    elif current_step == "QUIZ_GEN":
        step_instructions = """
Goal: Add course assessment quizzes.
Instructions:
- Discuss the final exam or assessments. Propose generating a comprehensive final quiz.
- Generate quiz questions and options.
- Provide [QUICK_REPLIES] like: ["Generate Final Quiz", "Skip Quiz", "Looks Good, Proceed!"].
"""
    elif current_step == "READY":
        step_instructions = """
Goal: Final confirmation and publishing.
Instructions:
- Congratulate the user on completing the draft!
- Sum up what has been created: course title, number of modules, and exam questions.
- Instruct them to click the "Publish" button to finalize.
- Provide [QUICK_REPLIES] like: ["Publish Course", "Go back to Details", "Restart Course Builder"].
"""

    system_prompt = f"""You are the AI Course Architect, a friendly and professional instructional designer. 
Your job is to interactively guide the user step-by-step through creating a custom course.

You are currently in the stage: **{current_step}**.
{step_instructions}

{progress_context}

CRITICAL RULES FOR METADATA SUGGESTION CARDS:
- If you generate or modify details, outline structures, or content prompts, you MUST wrap the complete JSON object inside '[METADATA]' and '[/METADATA]' tags.
- NEVER include raw JSON or markdown code blocks (like ```json) in your conversational reply text. Any JSON structure must reside ONLY inside [METADATA]...[/METADATA].
- Schemas:
  - Details: {{ "courseType": "Custom Course", "subject": "...", "courseName": "...", "description": "...", "price": "0", "duration": "...", "requirements": "...", "level": "...", "language": "...", "scriptingLanguage": "...", "evaluator": "..." }}
  - Structure: {{ "modules": [{{ "title": "...", "chapters": [{{ "title": "..." }}] }}] }}
  - Content Prompts: {{ "prompts": [{{ "module": "...", "title": "...", "prompt": "..." }}] }}


CRITICAL RULES FOR INLINE QUICK REPLIES:
- You MUST provide a list of relevant quick-reply options for the current conversation step to guide the user.
- Wrap this list as a JSON array of strings inside '[QUICK_REPLIES]' and '[/QUICK_REPLIES]' tags.
- E.g., [QUICK_REPLIES]["Beginner", "Intermediate", "Advanced"][/QUICK_REPLIES] or [QUICK_REPLIES]["Looks Good!", "Modify Title"][/QUICK_REPLIES]
- Never put these inside markdown code blocks. Keep them strictly in [QUICK_REPLIES] tags.

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
