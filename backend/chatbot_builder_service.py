import json
import re
import os
import logging
from openai import OpenAI
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger("chatbot_builder_service")

# Initialize OpenAI client locally using environment variables
def get_openai_client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

def extract_slots_from_message(user_message: str, current_slots: Dict[str, Any]) -> Dict[str, Any]:
    """
    Invokes OpenAI in structured JSON mode to extract slot values from the latest user message
    and merge them with existing slot values.
    """
    client = get_openai_client()
    
    system_prompt = """You are a slot extraction module for a course builder assistant.
Your task is to analyze the user's latest message and extract values for the following slots:
1. topic (the subject matter, e.g. "Python Programming", "World War II History")
2. learningGoal (what they want to achieve, e.g. "get a job", "build an app", "pass my exams")
3. currentLevel (familiarity with the topic, e.g. "beginner", "intermediate", "advanced", "novice")
4. learningStyle (how they prefer lessons to be structured, e.g. "hands-on coding", "videos & diagrams", "interactive quizzes", "structured tables", "detailed text explanations", "balanced combination")
5. duration (how detailed or long they want the course, e.g. "10 hours", "quick", "comprehensive", "3 hours")
6. language (defaults to "English")

Rules for Level:
- If the user mentions "basic to advance", "from scratch", "from zero", "for beginners", "no prior experience", or similar, the currentLevel must be "beginner". Do NOT set it to "advanced". Only extract "advanced" if they clearly say they already possess advanced experience/knowledge in the topic.

Rules for Goal:
- For learningGoal, if the user doesn't specify a project or career objective, but says they want to learn the topic (e.g. "learn Python from basic to advanced" or "just learn the basics"), extract their goal (e.g. "Learn Python from basic to advanced"). Do NOT leave it null if they expressed their learning intent.

Rules for Duration:
- Convert any duration description to numeric hours (e.g., "quick" -> "3", "standard" -> "8", "comprehensive" -> "15"). If they specify a number of hours, extract just the digit (e.g. "2"). If they mention weeks, ignore it or convert to hours.

Rules:
- Output a single JSON object with keys: "topic", "learningGoal", "currentLevel", "learningStyle", "duration", "language".
- Only extract a value if the user clearly mentions it or strongly implies it in their latest message. Otherwise, return null for that key.
- Do NOT carry over slots from the current slots unless the user modifies/updates them in the latest message. We will merge them in code.
"""

    user_prompt = f"""Latest User Message: "{user_message}"
Previously Extracted Slots: {json.dumps(current_slots)}
"""

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        extracted = json.loads(response.choices[0].message.content)
        
        # Merge logic: if extracted key is not null, overwrite current slot.
        merged = {**current_slots}
        for k in ["topic", "learningGoal", "currentLevel", "learningStyle", "duration", "language"]:
            val = extracted.get(k)
            if val is not None and str(val).strip() != "" and str(val).lower() != "null":
                merged[k] = val
                
        logger.info(f"[NLU Extraction] Extracted: {extracted} | Merged: {merged}")
        return merged
    except Exception as e:
        logger.error(f"[NLU Extraction] Error extracting slots: {e}")
        return current_slots

def determine_next_step(current_step: str, slots: Dict[str, Any], user_message: str) -> Tuple[str, Optional[str]]:
    """
    Programmatic solver that determines the next step in the dialog based on slot status and transitions.
    Returns (next_step, validation_error_message).
    """
    # 1. Normalize Slots First (ensures slot values are safe before any transitions)
    # Normalize Level
    level_val = slots.get("currentLevel")
    if level_val:
        lvl_lower = str(level_val).lower()
        if "begin" in lvl_lower or "new" in lvl_lower or "start" in lvl_lower or "novice" in lvl_lower or "zero" in lvl_lower or "scratch" in lvl_lower:
            slots["currentLevel"] = "beginner"
        elif "intermed" in lvl_lower or "medium" in lvl_lower or "some" in lvl_lower or "familiar" in lvl_lower:
            slots["currentLevel"] = "intermediate"
        elif "advanc" in lvl_lower or "expert" in lvl_lower or "proficient" in lvl_lower or "high" in lvl_lower:
            if "basic" in lvl_lower or "scratch" in lvl_lower:
                slots["currentLevel"] = "beginner"
            else:
                slots["currentLevel"] = "advanced"
        else:
            slots["currentLevel"] = "beginner" # Fallback

    # Normalize Style
    style_val = slots.get("learningStyle")
    if style_val:
        st_lower = str(style_val).lower()
        if "code" in st_lower or "hands" in st_lower or "practical" in st_lower or "exercise" in st_lower:
            slots["learningStyle"] = "hands-on coding"
        elif "video" in st_lower or "visual" in st_lower or "diagram" in st_lower or "movie" in st_lower:
            slots["learningStyle"] = "videos & diagrams"
        elif "quiz" in st_lower or "test" in st_lower or "question" in st_lower or "check" in st_lower:
            slots["learningStyle"] = "interactive quizzes"
        elif "table" in st_lower or "structured" in st_lower or "chart" in st_lower or "matrix" in st_lower:
            slots["learningStyle"] = "structured tables"
        elif "text" in st_lower or "read" in st_lower or "theory" in st_lower or "explain" in st_lower:
            slots["learningStyle"] = "detailed text explanations"
        else:
            slots["learningStyle"] = "balanced combination"

    # Normalize and Validate Duration (must be <= 20)
    duration_val = slots.get("duration")
    if duration_val:
        dur_lower = str(duration_val).lower()
        if "quick" in dur_lower or "short" in dur_lower or "crash" in dur_lower:
            slots["duration"] = "3"
        elif "standard" in dur_lower or "medium" in dur_lower or "moderate" in dur_lower:
            slots["duration"] = "8"
        elif "comprehensive" in dur_lower or "long" in dur_lower or "deep" in dur_lower:
            slots["duration"] = "15"
        else:
            digits = re.findall(r'\d+', str(duration_val))
            if digits:
                hours = int(digits[0])
                if hours > 20:
                    slots["duration"] = None # Clear invalid duration
                    return "ASK_DURATION", "I can only create a course that is 20 hours or less. Please select or type a duration within that limit."
                slots["duration"] = str(hours)
            else:
                slots["duration"] = "8" # default standard

    # 2. Check validations or re-confirmations for special steps
    if current_step == "CONFIRM_DETAILS":
        lowercase_msg = user_message.lower()
        confirm_words = [
            "looks good", "looks fine", "looks ok", "continue", "confirm", "yes", "yep", "yeah",
            "correct", "fine", "ok", "sure", "proceed", "generate", "create", "structure", "start",
            "go ahead", "do it", "let's go", "great", "perfect", "sounds good", "alright"
        ]
        if any(w in lowercase_msg for w in confirm_words):
            return "ASK_GENERATE_SKELETON", None
        return "CONFIRM_DETAILS", None

    elif current_step == "ASK_GENERATE_SKELETON":
        lowercase_msg = user_message.lower()
        confirm_words = ["yes", "continue", "looks good", "proceed", "generate", "correct", "confirm", "do it", "sure", "yep", "yeah"]
        if any(w in lowercase_msg for w in confirm_words):
            return "OUTLINE_EDIT", None
        return "ASK_GENERATE_SKELETON", None

    elif current_step == "OUTLINE_EDIT":
        lowercase_msg = user_message.lower()
        confirm_words = ["yes", "continue", "looks good", "proceed", "generate", "correct", "confirm", "happy", "fine", "ok", "go ahead"]
        if any(w in lowercase_msg for w in confirm_words):
            return "CONFIRM_GENERATE", None
        return "OUTLINE_EDIT", None

    elif current_step == "CONFIRM_GENERATE":
        return "CONFIRM_GENERATE", None

    elif current_step == "PROMPT_GEN":
        return "PROMPT_GEN", None

    elif current_step == "READY":
        return "READY", None

    # 3. Determine the next empty slot in priority order
    if not slots.get("topic"):
        return "ASK_TOPIC", None
    if not slots.get("learningGoal"):
        return "ASK_GOAL", None
    if not slots.get("currentLevel"):
        return "ASK_LEVEL", None
    if not slots.get("learningStyle"):
        return "ASK_STYLE", None
    if not slots.get("duration"):
        return "ASK_DURATION", None

    return "CONFIRM_DETAILS", None

def build_builder_system_prompt(next_step: str, slots: Dict[str, Any], validation_error: Optional[str] = None) -> str:
    """
    Constructs a highly focused system prompt for the NLG step to ask the user
    for the next slot value in a natural way.
    """
    topic_name = slots.get("topic") or "this subject"
    
    prompt = """You are the AI Course Architect, a warm, professional, and friendly AI Learning Mentor.
Your job is to interactively guide the user step-by-step through creating a personalized learning roadmap.
The user is creating this course for THEMSELVES to learn from. Frame all questions directly to the user (e.g., "for you", "your level", "your background").

GLOBAL RULES:
1. Warm Persona: Be conversational, natural, and friendly. Do not behave like a rigid form.
2. Structured Data Wrap: You MUST wrap the JSON metadata block in [METADATA]...[/METADATA] tags in your response.
3. No Raw JSON: Never output raw JSON, curly braces, or markdown code blocks (like ```json) in your conversational reply text.
4. Schema Mapping: The JSON metadata block must conform EXACTLY to the Details Schema:
   {
     "next_step": "<step_value>",
     "courseType": "Custom Course",
     "topic": "<topic_val>",
     "learningGoal": "<goal_val>",
     "currentLevel": "<level_val>",
     "learningStyle": "<style_val>",
     "duration": "<duration_val>",
     "language": "English",
     "scriptingLanguage": "NA",
     "evaluator": "Sarah Johnson"
   }
   (Ensure all slot values matching the current state are populated; use empty strings "" if not yet gathered).

5. DYNAMIC QUICK REPLIES: You MUST ALWAYS append dynamic quick replies at the very end of your conversational response (outside [METADATA] tags). Use EXACTLY the tag format: [quick_replies]["Option 1", "Option 2", ...][/quick_replies]. Generate 3 to 6 contextually appropriate suggestions.
   - For ASK_TOPIC: Suggest popular subjects (e.g. ["Python Programming", "English Grammar", "Digital Marketing", "Machine Learning"]).
   - For ASK_GOAL: Suggest 3-4 goals specific to their chosen topic (e.g. if topic is Python: ["Build a Web App", "Automate Excel Tasks", "Data Analysis & AI", "Get a Developer Job"]).
   - For ASK_LEVEL: Suggest level selections: ["Complete Beginner / Start Fresh", "Intermediate / Some experience", "Advanced / Deep Dive"].
   - For ASK_STYLE: Suggest style options based on our blocks: ["Hands-on Coding", "Interactive Quizzes", "Detailed Explanations", "Balanced Combination"].
   - For ASK_DURATION: Suggest hour limits: ["1 Hour", "2 Hours", "5 Hours", "10 Hours", "15 Hours", "20 Hours"].
   - For CONFIRM_DETAILS: Suggest confirmation: ["Confirm details & proceed", "Change topic", "Change duration", "Change level"].
   - For ASK_GENERATE_SKELETON: Suggest: ["Yes, generate modules!", "Go back"].
   - For OUTLINE_EDIT: Suggest: ["Looks good! Proceed to content", "Reduce modules", "Add new module", "Rename modules/chapters"].
   - For CONFIRM_GENERATE: Suggest: ["Generate Course Content", "Go back to outline"].

6. CONCISENESS & NO RECAPS: Keep your conversational responses extremely brief, clean, and direct. Do NOT repeat or recap the user's previous answers in every turn. Ask only the current question directly.
7. NO DEVELOPER TERMINOLOGY: Do NOT output sentences like "Let me summarize this in the metadata format" or "Here is the metadata". Simply output the conversational text and the [METADATA] block silently.
8. LANGUAGE: Do NOT ask any questions about language. Language is always English.
"""

    state_instructions = ""
    if next_step == "ASK_TOPIC":
        state_instructions = """
Current State: ASK_TOPIC
Goal: Ask the user what subject or topic they would like to learn.
Conversational Guidance: Ask a natural, welcoming question to discover their desired topic. Example: "What subject or topic would you like to explore today?"
"""
    elif next_step == "ASK_GOAL":
        state_instructions = f"""
Current State: ASK_GOAL
Goal: Discover the user's objective or goal for studying {topic_name}.
Conversational Guidance: Ask a natural, friendly question about what they hope to achieve (e.g. "What is your main goal for learning {topic_name}?").
"""
    elif next_step == "ASK_LEVEL":
        state_instructions = f"""
Current State: ASK_LEVEL
Goal: Discover their current level of experience or familiarity with {topic_name}.
Conversational Guidance: Ask a friendly question to gauge their current familiarity (e.g. "How much experience do you already have with {topic_name}?").
"""
    elif next_step == "ASK_STYLE":
        state_instructions = f"""
Current State: ASK_STYLE
Goal: Learn their preferred style of lesson structure.
Conversational Guidance: Ask a friendly, concise question (e.g. "How do you enjoy learning the most?").
"""
    elif next_step == "ASK_DURATION":
        error_addition = f"\nValidation Alert: {validation_error}\n" if validation_error else ""
        state_instructions = f"""
Current State: ASK_DURATION{error_addition}
Goal: Gather the duration they want to dedicate to this course.
Conversational Guidance: Ask how detailed they want the course to be. Example: "How detailed would you like this course to be (up to 20 hours)?"
If the validation alert is present, politely explain the 20-hour limit and guide them back.
"""
    elif next_step == "CONFIRM_DETAILS":
        state_instructions = f"""
Current State: CONFIRM_DETAILS
Goal: Show a clean, summary report of their requirements and ask for confirmation.
CRITICAL FORMATTING: You must output EXACTLY the text layout below in your conversational reply:
---
Here's a summary of your course requirements:

Topic: {slots.get('topic')}
Your Profile: {slots.get('learningStyle')}
Difficulty Level: {slots.get('currentLevel')}
Your Objective: {slots.get('learningGoal')}
Duration: {slots.get('duration')} Hours

Would you like to modify any of these details before I create the course structure for you?
---
Do NOT output any metadata block for CONFIRM_DETAILS. Keep it purely as a conversational reply in the format above.
"""
    elif next_step == "ASK_GENERATE_SKELETON":
        state_instructions = """
Current State: ASK_GENERATE_SKELETON
Goal: Ask for confirmation to generate outline modules.
Conversational Guidance: Output exactly: "Shall I start by creating the modules for you?"
Do NOT output any metadata block for this step.
"""
    elif next_step == "OUTLINE_EDIT":
        state_instructions = """
Current State: OUTLINE_EDIT
Goal: Ask the user to review the generated roadmap outline.
Conversational Guidance: Output exactly: "Here is your personalized learning roadmap outline. Do you have anything to change in this, or would you like to add any modules?"
Do NOT output the Details metadata card. Output the Course Structure metadata card inside [METADATA]...[/METADATA] conforming to the schema:
{
  "next_step": "CONFIRM_GENERATE",
  "modules": [...]
}
"""
    elif next_step == "CONFIRM_GENERATE":
        state_instructions = """
Current State: CONFIRM_GENERATE
Goal: Final confirmation before generating content.
Conversational Guidance: Output exactly: "The course structure has been finalized. Would you like me to start generating the complete course content?"
Do NOT output any JSON metadata block.
"""
    elif next_step == "PROMPT_GEN":
        state_instructions = """
Current State: PROMPT_GEN
Goal: Generate a highly detailed content blueprint/prompt for every single chapter in the course structure.
Conversational Guidance: Keep the conversational reply extremely short and clean (e.g. "Drafting the chapter prompts...").
Metadata Output Rules:
1. You MUST generate a "prompts" metadata block wrapped in [METADATA]...[/METADATA] tags.
2. The JSON schema inside [METADATA] must match:
   {
     "next_step": "CONFIRM_GENERATE",
     "prompts": [
       {
         "module": "<module_title>",
         "title": "<chapter_title>",
         "prompt": "Highly detailed instructional content prompt..."
       }
     ]
   }
3. Generate prompts for EVERY chapter. Do not truncate the output list.
"""
    elif next_step == "READY":
        state_instructions = """
Current State: READY
Goal: Course creation completed.
Conversational Guidance: Congratulate the user on generating the course. Explain that they can preview the course using the "Preview Course" button, or publish it using the "Publish Course" button.
Do NOT output any JSON metadata block.
"""

    prompt += state_instructions
    prompt += f"\n\nCURRENT SLOTS CONTEXT: {json.dumps(slots)}"
    return prompt

def parse_quick_replies(ai_reply: str) -> Tuple[str, list]:
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
            cleaned_reply = ai_reply[:start_idx] + ai_reply[end_idx + len(end_tag):]
        else:
            replies_str = ai_reply[content_start:].strip()
            cleaned_reply = ai_reply[:start_idx]
            
        try:
            parsed = json.loads(replies_str)
            if isinstance(parsed, list):
                quick_replies = [str(x) for x in parsed]
        except Exception as e:
            logger.error(f"Failed to parse quick replies: {e}")
            
    cleaned_reply = cleaned_reply.replace('[QUICK_REPLIES]', '').replace('[/QUICK_REPLIES]', '').replace('[quick_replies]', '').replace('[/quick_replies]', '').strip()
    return cleaned_reply, quick_replies

def reinject_quick_replies_into_history(messages: list) -> list:
    rebuilt = []
    for msg in messages:
        if msg.get("role") == "assistant":
            content = msg.get("content", "")
            # check if it already has quick replies
            if "[quick_replies]" not in content:
                content_lower = content.lower()
                if "what subject or topic" in content_lower or "what course topic" in content_lower:
                    content += '\n\n[quick_replies]["Python Programming", "English Grammar", "Digital Marketing", "Machine Learning"][/quick_replies]'
                elif "main goal for learning" in content_lower or "what is your objective" in content_lower:
                    content += '\n\n[quick_replies]["Build a Web App", "Automate Excel Tasks", "Data Analysis & AI", "Get a Developer Job"][/quick_replies]'
                elif "experience do you already have" in content_lower or "current level of knowledge" in content_lower or "experience with" in content_lower:
                    content += '\n\n[quick_replies]["Complete Beginner / Start Fresh", "Intermediate / Some experience", "Advanced / Deep Dive"][/quick_replies]'
                elif "enjoy learning the most" in content_lower or "preferred learning style" in content_lower:
                    content += '\n\n[quick_replies]["Hands-on Coding", "Interactive Quizzes", "Detailed Explanations", "Balanced Combination"][/quick_replies]'
                elif "detailed would you like this course to be" in content_lower or "duration you have in mind" in content_lower or "how much time" in content_lower:
                    content += '\n\n[quick_replies]["1 Hour", "2 Hours", "5 Hours", "10 Hours", "15 Hours", "20 Hours"][/quick_replies]'
                elif "summary of your course requirements" in content_lower:
                    content += '\n\n[quick_replies]["Confirm details & proceed", "Change topic", "Change duration", "Change level"][/quick_replies]'
            
            rebuilt.append({**msg, "content": content})
        else:
            rebuilt.append(msg)
    return rebuilt
