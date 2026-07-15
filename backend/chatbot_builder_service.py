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

def parse_number_from_text(text: str) -> Optional[int]:
    import re
    digits = re.findall(r'\d+', text)
    if digits:
        return int(digits[0])
    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
    }
    tokens = text.lower().replace(",", " ").replace(".", " ").split()
    for t in tokens:
        if t in word_to_num:
            return word_to_num[t]
    return None

def extract_slots_from_message(user_message: str, current_slots: Dict[str, Any], current_step: str = "ASK_TOPIC", draft_id: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Invokes OpenAI in structured JSON mode to extract slot values from the latest user message
    and merge them with existing slot values. Returns a tuple of (merged_slots, raw_extracted_slots).
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

Rules for Topic:
- Do NOT overwrite the "topic" slot once it has already been established, unless the user explicitly requests to change the topic. If the user mentions a topic name inside their objective/goal (e.g. "learn Python to build a web app" when the topic is already established as Python or similar), do NOT extract it as a new topic.

Rules for Goal:
- For learningGoal, if the user doesn't specify a project or career objective, but says they want to learn the topic (e.g. "learn Python from basic to advanced" or "just learn the basics"), extract their goal (e.g. "Learn Python from basic to advanced"). Do NOT leave it null if they expressed their learning intent.
- If the user is answering the goal question (currentStep is ASK_GOAL) and mentions subject names or topics (e.g. "Data Analysis & AI"), extract them as learningGoal (e.g. "Learn Data Analysis & AI"). Do NOT classify or extract them as the topic slot.

Rules for Duration:
- Convert any duration description to numeric hours (e.g., "quick" -> "3", "standard" -> "8", "comprehensive" -> "15"). If they specify a number of hours, extract just the digit (e.g. "2"). If they mention weeks, ignore it or convert to hours.

Rules:
- Output a single JSON object with keys: "topic", "learningGoal", "currentLevel", "learningStyle", "duration", "language".
- Only extract a value if the user clearly mentions it or strongly implies it in their latest message. Otherwise, return null for that key.
- Do NOT carry over slots from the current slots unless the user modifies/updates them in the latest message. We will merge them in code.
"""

    user_prompt = f"""Current Step: {current_step}
Latest User Message: "{user_message}"
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
        if draft_id:
            from metering_helper import track_chatbot_cost
            track_chatbot_cost(draft_id, response, LLM_MODEL, f"slot_extraction_{current_step}")
        
        # Merge logic: if extracted key is not null, overwrite current slot.
        merged = {**current_slots}
        for k in ["topic", "learningGoal", "currentLevel", "learningStyle", "duration", "language"]:
            val = extracted.get(k)
            if val is not None and str(val).strip() != "" and str(val).lower() != "null":
                # Programmatically lock topic from being overwritten in later steps (unless currently empty/cleared)
                if k == "topic" and current_slots.get("topic") is not None and str(current_slots.get("topic")).strip() != "" and current_step not in ["ASK_TOPIC", "EDIT_DETAILS_CHOICE", "CONFIRM_DETAILS"]:
                    logger.info(f"[NLU Extraction] Ignored extracted topic '{val}' since step is '{current_step}' (Topic Locked)")
                    continue
                merged[k] = val
                
        logger.info(f"[NLU Extraction] Extracted: {extracted} | Merged: {merged}")
        return merged, extracted
    except Exception as e:
        logger.error(f"[NLU Extraction] Error extracting slots: {e}")
        return current_slots, {}

def determine_next_step(current_step: str, slots: Dict[str, Any], user_message: str, extracted_slots: Optional[Dict[str, Any]] = None, has_existing_structure: bool = False) -> Tuple[str, Optional[str]]:
    """
    Programmatic solver that determines the next step in the dialog based on slot status and transitions.
    Returns (next_step, validation_error_message).
    """
    def is_newly_extracted(slot_key: str) -> bool:
        if not extracted_slots:
            return False
        val = extracted_slots.get(slot_key)
        return val is not None and str(val).strip() != "" and str(val).lower() != "null"

    lowercase_msg = user_message.lower()

    # 0. A. Skip-ahead protection: prevent going to structure or content before basic details are complete
    has_skip_keywords = any(w in lowercase_msg for w in ["module", "modules", "chapter", "chapters", "outline", "syllabus", "roadmap", "content", "lesson", "lessons", "structure"])
    details_incomplete = not (slots.get("topic") and slots.get("learningGoal") and slots.get("currentLevel") and slots.get("learningStyle") and slots.get("duration"))
    if current_step in ["ASK_TOPIC", "ASK_GOAL", "ASK_LEVEL", "ASK_STYLE", "ASK_DURATION"] and has_skip_keywords and details_incomplete:
        empty_step = "ASK_TOPIC"
        if not slots.get("topic"):
            empty_step = "ASK_TOPIC"
        elif not slots.get("learningGoal"):
            empty_step = "ASK_GOAL"
        elif not slots.get("currentLevel"):
            empty_step = "ASK_LEVEL"
        elif not slots.get("learningStyle"):
            empty_step = "ASK_STYLE"
        elif not slots.get("duration"):
            empty_step = "ASK_DURATION"
        return empty_step, "We need to complete the basic course details first. Let's complete the questions step-by-step so I can construct your course correctly."

    # 0. B. Universal details redirect: if user explicitly requests detail changes during outline or content phase
    if current_step in ["OUTLINE_EDIT", "EDIT_OUTLINE_CHOICE", "CONFIRM_GENERATE", "PROMPT_GEN", "READY"]:
        if any(w in lowercase_msg for w in ["change", "edit", "modify", "update", "correct"]) and any(w in lowercase_msg for w in ["detail", "details", "topic", "goal", "style", "level", "duration", "objective", "requirements", "hours", "basic info", "info", "basic"]):
            return "CONFIRM_DETAILS", None

    # 0. C. Conversational slot change requests override (only active during details questionnaire phase)
    if current_step in ["ASK_TOPIC", "ASK_GOAL", "ASK_LEVEL", "ASK_STYLE", "ASK_DURATION", "CONFIRM_DETAILS", "EDIT_DETAILS_CHOICE", "ASK_GENERATE_SKELETON"]:
        cleared_any = False
        if any(w in lowercase_msg for w in ["change topic", "change the topic", "different topic", "another topic", "edit topic", "choose topic"]):
            if not is_newly_extracted("topic"):
                if not has_existing_structure:
                    slots["topic"] = None
                    slots["learningGoal"] = None
                    slots["currentLevel"] = None
                    slots["learningStyle"] = None
                    slots["duration"] = None
                    cleared_any = True
        if any(w in lowercase_msg for w in ["change goal", "change the goal", "different goal", "another goal", "edit goal", "edit learning goal"]):
            if not is_newly_extracted("learningGoal"):
                slots["learningGoal"] = None
                cleared_any = True
        if any(w in lowercase_msg for w in ["change level", "change the level", "different level", "another level", "edit level", "edit difficulty level", "change experience"]):
            if not is_newly_extracted("currentLevel"):
                slots["currentLevel"] = None
                cleared_any = True
        if any(w in lowercase_msg for w in ["change style", "change the style", "different style", "another style", "edit style", "edit learning style"]):
            if not is_newly_extracted("learningStyle"):
                slots["learningStyle"] = None
                cleared_any = True
        if any(w in lowercase_msg for w in ["change duration", "change the duration", "different duration", "another duration", "edit duration", "edit time", "edit hours"]):
            if not is_newly_extracted("duration"):
                slots["duration"] = None
                cleared_any = True

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
        if "code" in st_lower or "hands" in st_lower or "practical" in st_lower or "exercise" in st_lower or "assignment" in st_lower or "project" in st_lower:
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
        if "edit" in lowercase_msg or "change" in lowercase_msg or "modify" in lowercase_msg:
            # Check if user specified any new slot value directly in the message
            has_new_val = any(is_newly_extracted(k) for k in ["topic", "learningGoal", "currentLevel", "learningStyle", "duration"])
            if not has_new_val:
                return "EDIT_DETAILS_CHOICE", None
        confirm_words = [
            "looks good", "looks fine", "looks ok", "continue", "confirm", "yes", "yep", "yeah",
            "correct", "fine", "ok", "sure", "proceed", "generate", "create", "structure", "start",
            "go ahead", "do it", "let's go", "great", "perfect", "sounds good", "alright"
        ]
        if any(w in lowercase_msg for w in confirm_words):
            return "OUTLINE_EDIT", None
        return "CONFIRM_DETAILS", None

    elif current_step == "EDIT_DETAILS_CHOICE":
        lowercase_msg = user_message.lower()
        has_new_val = any(is_newly_extracted(k) for k in ["topic", "learningGoal", "currentLevel", "learningStyle", "duration"])
        if has_new_val:
            pass
        else:
            cleared_any = False
            if "topic" in lowercase_msg or "subject" in lowercase_msg or "course name" in lowercase_msg:
                if not has_existing_structure:
                    slots["topic"] = None
                    slots["learningGoal"] = None
                    slots["currentLevel"] = None
                    slots["learningStyle"] = None
                    slots["duration"] = None
                    cleared_any = True
            if "goal" in lowercase_msg or "objective" in lowercase_msg or "learn" in lowercase_msg:
                slots["learningGoal"] = None
                cleared_any = True
            if "level" in lowercase_msg or "difficulty" in lowercase_msg or "experience" in lowercase_msg:
                slots["currentLevel"] = None
                cleared_any = True
            if "style" in lowercase_msg or "learn style" in lowercase_msg:
                slots["learningStyle"] = None
                cleared_any = True
            if "duration" in lowercase_msg or "time" in lowercase_msg or "hours" in lowercase_msg:
                slots["duration"] = None
                cleared_any = True
            
            if not cleared_any:
                return "EDIT_DETAILS_CHOICE", None

    elif current_step == "ASK_GENERATE_SKELETON":
        lowercase_msg = user_message.lower()
        if any(w in lowercase_msg for w in ["back", "no"]) or (any(verb in lowercase_msg for verb in ["edit", "change", "modify", "adjust"]) and any(noun in lowercase_msg for noun in ["detail", "summary", "topic", "goal", "level", "style", "duration", "objective", "requirements", "hours"])):
            return "CONFIRM_DETAILS", None
        confirm_words = ["yes", "continue", "looks good", "proceed", "generate", "correct", "confirm", "do it", "sure", "yep", "yeah"]
        if any(w in lowercase_msg for w in confirm_words):
            return "OUTLINE_EDIT", None
        return "ASK_GENERATE_SKELETON", None

    elif current_step in ["OUTLINE_EDIT", "EDIT_OUTLINE_CHOICE"]:
        lowercase_msg = user_message.lower()
        
        # Check if user wants to change details
        if any(w in lowercase_msg for w in ["change", "edit", "modify", "update", "correct"]) and any(w in lowercase_msg for w in ["detail", "details", "topic", "goal", "style", "level", "duration", "objective", "requirements", "hours", "basic info", "info", "basic"]):
            return "CONFIRM_DETAILS", None

        if current_step == "OUTLINE_EDIT":
            if "edit" in lowercase_msg or "change" in lowercase_msg or "modify" in lowercase_msg:
                specifies_change = any(w in lowercase_msg for w in ["add", "remove", "delete", "reduce", "rename", "reorder", "chapter", "module"])
                if not specifies_change:
                    return "EDIT_OUTLINE_CHOICE", None
            confirm_words = ["yes", "continue", "looks good", "proceed", "generate", "correct", "confirm", "happy", "fine", "ok", "go ahead"]
            if any(w in lowercase_msg for w in confirm_words):
                return "CONFIRM_GENERATE", None
            return "OUTLINE_EDIT", None
        else:
            return "OUTLINE_EDIT", None

    elif current_step == "ASK_REDUCE_COUNT":
        return "OUTLINE_EDIT", None

    elif current_step == "ASK_ADD_TOPIC":
        return "OUTLINE_EDIT", None

    elif current_step == "CONFIRM_GENERATE":
        lowercase_msg = user_message.lower()
        if "back" in lowercase_msg or "no" in lowercase_msg or "change" in lowercase_msg or "edit" in lowercase_msg:
            return "OUTLINE_EDIT", None
        return "CONFIRM_GENERATE", None

    elif current_step == "PROMPT_GEN":
        return "PROMPT_GEN", None

    elif current_step == "READY":
        return "READY", None

    # 3. Fallback recoveries to prevent getting stuck in early slots if user skips ahead
    if not slots.get("topic"):
        slots["learningGoal"] = None
        slots["currentLevel"] = None
        slots["learningStyle"] = None
        slots["duration"] = None
        return "ASK_TOPIC", None

    if not slots.get("learningGoal") and (slots.get("learningStyle") or slots.get("duration")):
        slots["learningGoal"] = f"Learn {slots.get('topic')}"

    if not slots.get("currentLevel") and (slots.get("learningStyle") or slots.get("duration")):
        slots["currentLevel"] = "beginner"

    if not slots.get("learningStyle") and slots.get("duration"):
        slots["learningStyle"] = "balanced combination"

    # 4. Determine the next empty slot in priority order
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

 6. CONCISENESS & NO RECAPS: Keep your conversational responses extremely brief, clean, and direct. Do NOT repeat, recap, list, confirm, or summarize the user's previous answers or course requirements (like Topic, Goal, Level, Style, Duration) in your conversational text under any circumstances. Never output a text-based bullet summary of the requirements. Keep the recap strictly to the interactive Details card, and output only the direct conversational question/response in text.
7. NO DEVELOPER TERMINOLOGY: Do NOT output sentences like "Let me summarize this in the metadata format" or "Here is the metadata". Simply output the conversational text and the [METADATA] block silently.
8. LANGUAGE: Do NOT ask any questions about language. Language is always English.
9. NO EARLY ROADMAP GENERATION: Do NOT generate or list the course outline modules, chapters, or syllabus structure in your conversational text at any point during the questionnaire phase (ASK_TOPIC, ASK_GOAL, ASK_LEVEL, ASK_STYLE, ASK_DURATION, CONFIRM_DETAILS). Only answer the user, ask the corresponding slot question, or recap details. You will generate the outline structure only when you transition to the OUTLINE_EDIT step.
10. NEVER CONFIRM OR LIST SLOTS IN TEXT: Under no circumstances should you list or print the course details (such as "Topic: ...", "Difficulty: ...", "Duration: ...") as text in your conversational response. This includes confirming updated values when details are edited. Do NOT repeat or print them back to the user. Simply state that you have updated or saved the details, and prompt them to confirm or proceed, relying entirely on the visual Details suggestion card to show the current values.
"""

    state_instructions = ""
    if next_step == "ASK_TOPIC":
        state_instructions = """
Current State: ASK_TOPIC
Goal: Ask the user what subject or topic they would like to learn.
Conversational Guidance: Ask a natural, welcoming question to discover their desired topic. 
You MUST mirror the user's greeting tone and wording dynamically. For example:
- If the user starts with "hi", "hello", "hey", respond with: "Hello! I'm excited to help you create a personalized learning roadmap. What subject or topic would you like to explore today?"
- If the user starts with an informal/colloquial greeting like "hey dude", "yo", "sup", "what's up", respond in the same style: "Hey dude! I'm excited to help you create a personalized learning roadmap. What topic would you like to explore today?"
- Adapt friendly and mirror their specific greeting style.
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
        topic_lower = str(slots.get("topic", "")).lower()
        is_programming = any(x in topic_lower for x in ["python", "java", "c++", "coding", "program", "developer", "react", "javascript", "typescript", "sql", "backend", "frontend", "software", "git", "c#", "html", "css", "database", "node", "express"])
        if is_programming:
            style_suggestions = '["Hands-on Coding", "Interactive Quizzes", "Detailed Explanations", "Balanced Combination"]'
        else:
            style_suggestions = '["Detailed Explanations", "Interactive Quizzes", "Structured Tables", "Balanced Combination"]'

        state_instructions = f"""
Current State: ASK_STYLE
Goal: Learn their preferred style of lesson structure.
Conversational Guidance: Ask a friendly, concise question (e.g. "How do you enjoy learning the most?").
Suggest styles below immediately in a quick replies block:
[quick_replies]{style_suggestions}[/quick_replies]
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
Conversational Guidance: Ask the user to review their requirements in the summary card below. Ask if they look good or if they want to modify anything.
Example: "Here is a summary of your course requirements. Would you like to modify any of these details before I create the course structure for you?"
CRITICAL RULE: Do NOT list, repeat, or output the course details (Topic, Goal, Level, Style, Duration) inside your conversational text. Keep it strictly to a short confirmation question.
Do NOT output any metadata block for CONFIRM_DETAILS. Keep it purely as a conversational reply in the format above, immediately followed by the [quick_replies] block.

Refusal Rule: If the user requests to modify the syllabus structure, add/remove modules, or edit chapters while they are in the CONFIRM_DETAILS step, politely refuse. Explain that they must confirm the details first to generate the syllabus outline.
"""
    elif next_step == "EDIT_DETAILS_CHOICE":
        state_instructions = """
Current State: EDIT_DETAILS_CHOICE
Goal: Ask the user which detail they would like to modify.
Conversational Guidance: Ask a friendly question (e.g. "What details would you like to edit?").
Suggest the choices below immediately in a quick replies block:
[quick_replies]["Edit Topic", "Edit Learning Goal", "Edit Difficulty Level", "Edit Learning Style", "Edit Duration"][/quick_replies]
"""
    elif next_step == "ASK_GENERATE_SKELETON":
        state_instructions = """
Current State: ASK_GENERATE_SKELETON
Goal: Ask for confirmation to generate outline modules.
Conversational Guidance: Output exactly: "Shall I start by creating the modules for you?"
Do NOT output any metadata block for this step.
"""
    elif next_step == "ASK_REDUCE_COUNT":
        state_instructions = """
Current State: ASK_REDUCE_COUNT
Goal: Ask the user how many modules they would like to reduce.
Conversational Guidance: Ask a friendly question: "How many modules are you looking to reduce?"
Suggest the choices below immediately in a quick replies block:
[quick_replies]["Reduce by 1 module", "Reduce by 2 modules", "Your choice (Reduce by 2)"][/quick_replies]
Do NOT output any JSON metadata block.
"""
    elif next_step == "ASK_ADD_TOPIC":
        state_instructions = """
Current State: ASK_ADD_TOPIC
Goal: Ask the user if they have specific topics in mind for the new modules or if they prefer the AI's choice.
Conversational Guidance: Ask a friendly, guiding question letting the user know they can specify custom topics or let the AI automatically generate them. For example: "What topics would you like the new modules to cover? You can specify the topics, or I can automatically generate relevant modules for you."
Suggest the choices below immediately in a quick replies block:
[quick_replies]["Your choice", "Add specific topic"][/quick_replies]
Do NOT output any JSON metadata block.
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

Guidance: If the user requests to edit course details (like changing the topic, goal, level, style, or duration), they will be taken back to the CONFIRM_DETAILS step.
"""
    elif next_step == "EDIT_OUTLINE_CHOICE":
        state_instructions = """
Current State: EDIT_OUTLINE_CHOICE
Goal: Ask the user what modifications they want to make to the syllabus outline.
Conversational Guidance: Ask a friendly question (e.g. "What would you like to change in the syllabus outline?").
Suggest the choices below immediately in a quick replies block:
[quick_replies]["Reduce modules", "Add new module", "Rename modules/chapters", "Reorder modules"][/quick_replies]
"""
    elif next_step == "CONFIRM_GENERATE":
        state_instructions = """
Current State: CONFIRM_GENERATE
Goal: Final confirmation before generating content.
Conversational Guidance: Output exactly: "The course structure has been finalized. Would you like me to start generating the complete course content?"
Do NOT output any JSON metadata block.
Suggest the choices below immediately in a quick replies block:
[quick_replies]["Yes, generate content", "No, go back to outline"][/quick_replies]
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

def reinject_quick_replies_into_history(messages: list, slots: dict) -> list:
    rebuilt = []
    topic_lower = str(slots.get("topic", "")).lower()
    is_programming = any(x in topic_lower for x in ["python", "java", "c++", "coding", "program", "developer", "react", "javascript", "typescript", "sql", "backend", "frontend", "software", "git", "c#", "html", "css", "database", "node", "express"])

    for msg in messages:
        if msg.get("role") == "assistant":
            content = msg.get("content", "")
            # check if it already has quick replies
            if "[quick_replies]" not in content:
                content_lower = content.lower()
                if "subject" in content_lower or "topic" in content_lower or "what would you like to explore" in content_lower:
                    content += '\n\n[quick_replies]["Python Programming", "English Grammar", "Digital Marketing", "Machine Learning"][/quick_replies]'
                elif "goal" in content_lower or "objective" in content_lower or "hope to achieve" in content_lower:
                    content += '\n\n[quick_replies]["Build a Web App", "Automate Excel Tasks", "Data Analysis & AI", "Get a Developer Job"][/quick_replies]'
                elif "level" in content_lower or "experience" in content_lower or "familiar" in content_lower:
                    content += '\n\n[quick_replies]["Complete Beginner / Start Fresh", "Intermediate / Some experience", "Advanced / Deep Dive"][/quick_replies]'
                elif "style" in content_lower or "prefer" in content_lower or "enjoy learning" in content_lower:
                    if is_programming:
                        content += '\n\n[quick_replies]["Hands-on Coding", "Interactive Quizzes", "Detailed Explanations", "Balanced Combination"][/quick_replies]'
                    else:
                        content += '\n\n[quick_replies]["Detailed Explanations", "Interactive Quizzes", "Structured Tables", "Balanced Combination"][/quick_replies]'
                elif "duration" in content_lower or "hours" in content_lower or "hour" in content_lower or "time" in content_lower:
                    content += '\n\n[quick_replies]["1 Hour", "2 Hours", "5 Hours", "10 Hours", "15 Hours", "20 Hours"][/quick_replies]'
                elif "summary" in content_lower or "requirements" in content_lower or "modify any of these" in content_lower:
                    content += '\n\n[quick_replies]["Confirm details & proceed", "Change topic", "Change duration", "Change level"][/quick_replies]'
                elif "what details would you like to edit" in content_lower or "what would you like to edit" in content_lower:
                    content += '\n\n[quick_replies]["Edit Topic", "Edit Learning Goal", "Edit Difficulty Level", "Edit Learning Style", "Edit Duration"][/quick_replies]'
                elif "how many modules are you looking to reduce" in content_lower or "how many modules would you like to reduce" in content_lower:
                    content += '\n\n[quick_replies]["Reduce by 1 module", "Reduce by 2 modules", "Your choice (Reduce by 2)"][/quick_replies]'
                elif "do you have any specific topic in mind for the new module" in content_lower or "specific topic in mind for the new module" in content_lower:
                    content += '\n\n[quick_replies]["Your choice", "Add specific topic"][/quick_replies]'
                elif "change in the syllabus outline" in content_lower or "what would you like to change" in content_lower:
                    content += '\n\n[quick_replies]["Reduce modules", "Add new module", "Rename modules/chapters", "Reorder modules"][/quick_replies]'
                elif "generating the complete course content" in content_lower or "start generating the complete" in content_lower or "finalized. would you like me" in content_lower or "confirm and proceed" in content_lower:
                    content += '\n\n[quick_replies]["Yes, generate content", "No, go back to outline"][/quick_replies]'
            
            rebuilt.append({**msg, "content": content})
        else:
            rebuilt.append(msg)
    return rebuilt
