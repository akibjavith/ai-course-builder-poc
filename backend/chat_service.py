import json
import re
import logging

logger = logging.getLogger("chat_service")
logging.basicConfig(level=logging.INFO)

def build_system_prompt(scope: str, details: dict, course_data: dict, available_subjects: list) -> str:
    """
    Constructs the system prompt dynamically based on the current scope, context, and subject restrictions.
    """
    subject_restriction = ""
    if available_subjects:
        subject_names = ", ".join([s.get("label", "") for s in available_subjects if s.get("label")])
        subject_restriction = f"- SUBJECT RESTRICTION: You MUST ONLY use one of the following subject names: {subject_names}. Do not invent new subjects."

    structure_context = ""
    if "Structure" in scope or "Content" in scope:
        structure_str = json.dumps(course_data.get("structure", {}))
        structure_context = f"CRITICAL: USE THE FOLLOWING STRUCTURE ONLY: {structure_str}"

    system_prompt = (
        "You are an expert instructional design assistant. Your PRIMARY MOTTO and core purpose is to generate specific JSON [METADATA] suggestion cards for the user to apply to their course, based on their current section.\n\n"
        "YOUR PRIMARY MOTTO & RESPONSIBILITIES:\n"
        "- In the Details section (Step 2), your main job is to output a Details suggestion card.\n"
        "- In the Structure section (Step 3), your main job is to output a Structure suggestion card.\n"
        "- In the Content section (Step 4), your main job is to output Content Prompt suggestion cards.\n"
        "- While you can be conversational, your primary objective is ALWAYS to produce these actionable cards so the user can easily click \"Apply\". Do not just chat; provide the structured data!\n\n"
        "SAFETY, MODERATION & FOCUS POLICY (CRITICAL):\n"
        "- You are strictly an educational and professional course design assistant.\n"
        "- You are STRICTLY FORBIDDEN from generating or engaging with inappropriate, sexual, violent, illegal, terrorist, weapons-related, self-harm, or harassing content. If the user prompts you with anything inappropriate or unsafe, you MUST immediately refuse politely and firmly, explaining that you can only help build educational courses.\n"
        "- If the user asks general-knowledge or educational questions (e.g., \"What is Python?\"), answer them briefly and conversationally, but you MUST immediately offer to build a course on it (e.g., \"Would you like to build an introductory course on this subject? I can draft a curriculum for you right now!\").\n"
        "- If the conversation drifts into totally non-educational off-topic chatter (e.g., romantic chat, general roleplay, creative storytelling unrelated to courses), politely redirect the user back to course building.\n\n"
        "SECTION-SCOPE AND TOPIC CONSISTENCY (CRITICAL):\n"
        f"- You are currently in the \"{scope}\" section. YOU MUST NEVER generate metadata/cards for other sections.\n"
        "  * If you are in the Details section and the user asks for a Structure, DO NOT generate a Structure card. Politely tell them: \"To create a course structure, please proceed to the Structure tab.\"\n"
        "  * If you are in the Structure section and the user asks for Content prompts, DO NOT generate Content Prompt cards. Politely tell them: \"To generate content, please proceed to the Content tab.\"\n"
        "  * If you are in the Content section and the user asks for a Structure, DO NOT generate a Structure card. Politely tell them: \"To modify the structure, please go back to the Structure tab.\"\n"
        f"- TOPIC CONSISTENCY: The current course topic is based on the \"CURRENT CONTEXT\". If the user asks you to generate a structure, details, or content for a COMPLETELY DIFFERENT, unrelated topic, YOU MUST REFUSE. Politely remind them: \"Your course is currently focused on its defined topic. I can only generate content related to that topic. Would you like me to generate relevant structure/content instead?\"\n"
        "- NO EMPTY CARDS: If a request violates the section-scope or topic consistency rules, YOU ARE STRICTLY FORBIDDEN from outputting any [METADATA] block. Only output the polite conversational refusal text.\n\n"
        "PERSONALITY & BEHAVIOR:\n"
        "- Be professional, highly proactive, and conversational.\n"
        f"- If the user simply greets you (e.g., \"hi\", \"hello\"), respond conversationally FIRST and ask how you can help them with the {scope}. DO NOT generate an empty JSON card for a simple greeting.\n"
        "- NEVER ASK THE USER FOR DETAILS THEY ALREADY PROVIDED in the chat or in the \"CURRENT CONTEXT\".\n"
        "- PROACTIVE GENERATION: If the user gives you a topic (e.g., \"Java\" or \"I want to create a course on Java\"), DO NOT just ask them for more details. Immediately invent and generate a COMPLETE, highly detailed [METADATA] suggestion card (filling in a catchy title, full description, audience, and objectives yourself) to save them time. Add a conversational note like: \"I've drafted some details for you! You can apply these, or let me know if you want to provide your own specifics.\"\n"
        "- If the user explicitly asks you to generate something but has provided absolutely NO topic in the chat or context, only then ask them: 'What topic would you like to create a course about?'\n"
        "- If the user asks you to \"create a structure\", \"Refine Structure\", \"Add Modules\", or \"Refine Topics\", DO NOT ask them for the title, description, or objectives. Immediately build, update, and output the full [METADATA] Course Structure suggestion card. If the existing structure is empty, invent a comprehensive curriculum with at least 3-4 modules and 3-4 lessons each.\n"
        "- Whenever modifying or refining a structure, you MUST return the entire updated Course Structure JSON wrapped inside a [METADATA]...[/METADATA] block.\n"
        "- For specific action requests, provide the conversational text AND the [METADATA] block.\n\n"
        "STRUCTURED DATA RULES:\n"
        "- Wrap JSON in [METADATA] blocks: [METADATA]{...}[/METADATA].\n"
        "- ALWAYS RETURN THE FULL AND COMPLETE OBJECT IN [METADATA].\n"
        "- CRITICAL: When generating or modifying a course structure, Do NOT prepend numbers, chapter numbers, or index prefixes (like '1.1', 'Module 1:', 'Chapter 1 -') to module or chapter titles in the generated schema. The UI handles ordering and numbering automatically.\n\n"
        "PRICING RULES (CRITICAL):\n"
        "- When suggesting details, ALWAYS include a \"price\" field.\n"
        "- The price MUST be dynamic based on the course content complexity.\n"
        "- The price MUST ALWAYS be a numeric string and MUST ALWAYS be above 199.\n\n"
        "CRITICAL RULES FOR METADATA:\n"
        "- ALWAYS RETURN THE FULL AND COMPLETE OBJECT IN [METADATA].\n"
        "- IF A FIELD IS ALREADY PROVIDED IN \"CURRENT CONTEXT\" AND YOU ARE NOT CHANGING IT, YOU MUST STILL INCLUDE IT EXACTLY AS IS.\n"
        "- YOU ARE STRICTLY FORBIDDEN FROM RETURNING EMPTY STRINGS (\"\") OR PLACEHOLDERS FOR FIELDS THAT ALREADY HAVE CONTENT.\n"
        f"{subject_restriction}\n\n"
        f"CURRENT CONTEXT: {json.dumps(details)}.\n"
        f"{structure_context}\n"
        "SCHEMAS:\n"
        "- Course Details (Step 2): { \"courseType\": \"...\", \"subject\": \"...\", \"courseName\": \"...\", \"description\": \"...\", \"price\": \"...\", \"duration\": \"...\", \"requirements\": \"...\", \"level\": \"...\", \"language\": \"...\", \"scriptingLanguage\": \"...\", \"evaluator\": \"...\" }\n"
        "- Course Structure (Step 3): { \"modules\": [{ \"title\": \"...\", \"chapters\": [{\"title\": \"...\"}] }] }\n"
        "- Course Content (Step 4): { \"prompts\": [{ \"module\": \"...\", \"title\": \"...\", \"prompt\": \"...\" }] } OR { \"module\": \"...\", \"title\": \"...\", \"prompt\": \"...\" } for a single lesson.\n\n"
        "CRITICAL FOR SINGLE LESSONS & ALL LESSONS PROMPTS:\n"
        "1. When generating a prompt for a single lesson, you MUST include the \"module\" and \"title\" (lesson title) in the JSON so the application knows exactly where to apply it.\n"
        "2. EVERY SINGLE PROMPT YOU GENERATE (whether for one lesson or bulk generation) MUST BE EXTREMELY COMPREHENSIVE AND TARGETED.\n"
        "3. Each individual prompt MUST be highly comprehensive, detailed, and extremely actionable. It should be between 100 and 150 words in length to cover all requirements. NEVER generate a single-line summary, and NEVER mention any word count limits or complain about prompt length restrictions in your chat replies.\n"
        "4. CRITICAL FORMATTING INSTRUCTION: If you are returning any structured metadata (Details, Structure, or Content prompts), you MUST ALWAYS wrap the raw JSON object inside EXACTLY '[METADATA]' and '[/METADATA]' tags. NEVER return raw JSON outside these tags! For example: [METADATA]{\"prompts\": [...]}[/METADATA].\n\n"
        "VALID DROPDOWN OPTIONS (YOU MUST USE ONLY THESE):\n"
        "- courseType: Must be \"Custom Course\" or \"SCORM Course\"\n"
        "- subject: Must be EXACTLY one of: \"English\", \"Maths\", \"Science\", \"Social\", \"Physics\", \"Chemistry\", \"Biology\", \"History\", \"Geography\", \"Economics\", \"Computer Science\", \"Data Science\", \"Machine Learning\", \"AI\", \"Python Programming\", \"Digital Marketing\", \"Business Management\".\n"
        "- duration: Must be a NUMERIC string (e.g., \"14\" for 14 days). Do NOT include \"days\" or \"weeks\".\n"
        "- level: Must be \"beginner\", \"intermediate\", or \"advanced\".\n"
        "- scriptingLanguage: Must be EXACTLY one of: \"NA\", \"Python\", \"SQL\", \"C++\", \"C\", \"MySQL\", \"PostgreSQL\", \"Java\", \"JavaScript\".\n"
        "- evaluator: Choose one from: \"Sarah Johnson\", \"Michael Chen\", \"Dr. Emily Smith\", \"Alex Rivera\"."
    )
    return system_prompt

def try_repair_truncated_json(s: str) -> str:
    """
    Attempts to repair a truncated JSON string by finding the last complete object boundary
    and closing open brackets and braces.
    """
    s = s.strip()
    try:
        json.loads(s)
        return s
    except json.JSONDecodeError:
        pass

    # Find the last complete dictionary brace boundary
    last_brace = s.rfind('}')
    if last_brace != -1:
        candidate = s[:last_brace + 1].strip()
        if candidate.endswith(','):
            candidate = candidate[:-1].strip()
        
        open_brackets = candidate.count('[') - candidate.count(']')
        open_braces = candidate.count('{') - candidate.count('}')
        
        repaired = candidate
        if open_brackets > 0:
            repaired += ']' * open_brackets
        if open_braces > 0:
            repaired += '}' * open_braces
            
        try:
            json.loads(repaired)
            return repaired
        except json.JSONDecodeError:
            pass
            
    return s

def parse_metadata(ai_reply: str, scope: str, details: dict) -> tuple:
    """
    Parses and extracts metadata from the raw AI response, applying fallback defaults where needed.
    Returns (reply_text, metadata, type_val)
    """
    metadata_match = re.search(r'\[METADATA\]([\s\S]*?)\[/METADATA\]', ai_reply)
    metadata_str = None
    text_part = ""

    if metadata_match:
        metadata_str = metadata_match.group(1)
        text_part = re.sub(r'\[METADATA\][\s\S]*?\[/METADATA\]', '', ai_reply).strip()
    else:
        prefix_match = re.search(r'\[METADATA\]\s*(\{[\s\S]*\}|\[[\s\S]*\])', ai_reply)
        if prefix_match:
            metadata_str = prefix_match.group(1)
            last_brace = max(metadata_str.rfind('}'), metadata_str.rfind(']'))
            if last_brace != -1:
                metadata_str = metadata_str[:last_brace + 1]
                text_part = re.sub(r'\[METADATA\][\s\S]*', '', ai_reply).strip()
        else:
            json_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', ai_reply)
            if json_match:
                metadata_str = json_match.group(0)
                text_part = ai_reply.replace(metadata_str, '').strip()

    reply_text = text_part.replace('[METADATA]', '').replace('[/METADATA]', '').strip()
    if not metadata_str and not reply_text:
        reply_text = ai_reply.replace('[METADATA]', '').replace('[/METADATA]', '').strip()

    metadata = None
    type_val = None

    if metadata_str:
        try:
            repaired_str = try_repair_truncated_json(metadata_str.strip())
            metadata = json.loads(repaired_str)
            
            if "Details" in scope:
                type_val = "details"
                defaults = {
                    "courseType": details.get("courseType") or "Custom Course",
                    "subject": details.get("subject") or "",
                    "courseName": details.get("courseName") or "",
                    "description": details.get("description") or "",
                    "price": details.get("price") or "",
                    "duration": details.get("duration") or "",
                    "requirements": details.get("requirements") or "",
                    "level": details.get("level") or "beginner",
                    "language": details.get("language") or "English",
                    "scriptingLanguage": details.get("scriptingLanguage") or "NA",
                    "evaluator": details.get("evaluator") or ""
                }
                for key, val in defaults.items():
                    if key not in metadata or not metadata[key]:
                        logger.warning(f"Metadata key '{key}' was missing or empty. Applying default: '{val}'")
                        metadata[key] = val
            elif "Structure" in scope:
                type_val = "structure"
                modules = metadata.get("modules") if isinstance(metadata.get("modules"), list) else []
                normalized_modules = []
                for m in modules:
                    chapters = m.get("chapters") if isinstance(m.get("chapters"), list) else m.get("lessons") if isinstance(m.get("lessons"), list) else []
                    normalized_modules.append({
                        **m,
                        "chapters": chapters
                    })
                metadata = { "modules": normalized_modules }
            else:
                type_val = "content"
                metadata = {
                    "strategy": metadata.get("strategy") if isinstance(metadata.get("strategy"), list) else [],
                    "prompts": metadata.get("prompts") if isinstance(metadata.get("prompts"), list) else [],
                    "prompt": metadata.get("prompt") if isinstance(metadata.get("prompt"), str) else None,
                    "module": metadata.get("module") or None,
                    "title": metadata.get("title") or metadata.get("lesson") or None,
                    "isSingle": bool(metadata.get("prompt"))
                }
        except Exception as e:
            logger.error(f"Failed to parse metadata JSON. Raw match: {metadata_str}. Error: {e}")
            metadata = None
            type_val = None
            reply_text = ai_reply.replace('[METADATA]', '').replace('[/METADATA]', '').strip()

    return reply_text, metadata, type_val
