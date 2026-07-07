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

    topic_refusal_action = "relevant details"
    if "Structure" in scope:
        topic_refusal_action = "a relevant structure"
    elif "Content" in scope:
        topic_refusal_action = "relevant lesson content"

    scope_instructions = ""
    if "Details" in scope:
        scope_instructions = (
            "  * If the user explicitly asks you to generate modules, chapters, lessons, or the course curriculum layout (structure), DO NOT generate a Structure card. Politely refuse and tell them: \"To create a course structure, please proceed to the Structure tab.\"\n"
            "  * If the user asks for content prompts or content generation: Politely refuse and tell them: \"To generate course content, please proceed to the Content tab.\"\n"
            "  * Fulfill any requests to generate or refine the course details (course name, description, duration, requirements, level, language, price, etc.) in this section. NEVER refuse or redirect details requests."
        )
    elif "Structure" in scope:
        scope_instructions = (
            "  * If the user asks for course details (name, description, level, duration, etc.) or a details card: Politely refuse and tell them: \"To modify the course details, please go back to the Details tab.\"\n"
            "  * If the user asks for content prompts or content generation: Politely refuse and tell them: \"To generate course content, please proceed to the Content tab.\"\n"
            "  * Fulfill any requests to generate or refine the course structure/syllabus in this section."
        )
    elif "Content" in scope:
        scope_instructions = (
            "  * If the user asks for course details (name, description, level, duration, etc.): Politely refuse and tell them: \"To modify the course details, please go back to the Details tab.\"\n"
            "  * If the user asks for course structure/syllabus/modules/chapters: Politely refuse and tell them: \"To modify the course structure, please go back to the Structure tab.\"\n"
            "  * Fulfill any requests to generate or refine content prompts in this section."
        )

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
        "SECTION-SCOPE RULES (CRITICAL - YOU MUST ADHERE STRICTLY TO THIS MATRIX):\n"
        f"- You are currently in the \"{scope}\" section. YOU MUST NEVER generate metadata/suggestion cards for other sections.\n"
        f"{scope_instructions}\n"
        f"- TOPIC CONSISTENCY: If the course already has a defined, non-empty topic in the \"CURRENT CONTEXT\" (i.e. a specific courseName and description), and the user asks you to generate a structure, details, or content for a COMPLETELY DIFFERENT, unrelated topic (for example, asking to design a Python course when the current course context is English), YOU MUST REFUSE. Politely remind them: \"Your course is currently focused on its defined topic. I can only generate content related to that topic. Would you like me to generate {topic_refusal_action} instead?\" However, note that generating lesson prompts, course structures, or content plans for the lessons of the current course is NOT a different topic and MUST always be processed successfully without refusal. Do NOT refuse requests to generate prompts or outlines for the current course's lessons."
        "- NO EMPTY CARDS: If a request violates these section-scope rules or topic consistency, YOU ARE STRICTLY FORBIDDEN from outputting any [METADATA] block. Only output the polite conversational refusal text.\n\n"
        "PERSONALITY & BEHAVIOR:\n"
        "- Be professional, highly proactive, and conversational.\n"
        f"- If the user simply greets you (e.g., \"hi\", \"hello\"), respond conversationally FIRST and ask how you can help them with the {scope}. DO NOT generate an empty JSON card for a simple greeting.\n"
        "- NEVER ASK THE USER FOR DETAILS THEY ALREADY PROVIDED in the chat or in the \"CURRENT CONTEXT\".\n"
        "- PROACTIVE GENERATION: If the user gives you a topic (e.g., \"Java\" or \"I want to create a course on Java\"), DO NOT just ask them for more details. Immediately invent and generate a COMPLETE, highly detailed [METADATA] suggestion card (filling in a catchy title, full description, audience, and objectives yourself) to save them time. Add a conversational note like: \"I've drafted some details for you! You can apply these, or let me know if you want to provide your own specifics.\"\n"
        "- PROACTIVE DETAILS REFINEMENT: If the user asks you to \"Refine Details\", \"Refine these course details\", or \"Suggest Details\", DO NOT ask them for specific changes, requirements, descriptions, or parameters. You MUST immediately and proactively invent, enhance, and optimize the details yourself (making the requirements more professional, the description more engaging, etc.) and output the complete updated Course Details JSON wrapped in a [METADATA]...[/METADATA] block.\n"
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
        "- YOU ARE STRICTLY FORBIDDEN from outputting any raw JSON, curly braces, or markdown code blocks (like ```json) in your conversational reply text. Any structured data must reside ONLY inside the [METADATA]...[/METADATA] wrapper. Do not repeat the JSON inside markdown code blocks or in the text reply.\n"
        f"{subject_restriction}\n\n"
        f"CURRENT CONTEXT: {json.dumps(details)}.\n"
        f"{structure_context}\n"
        "SCHEMAS:\n"
        "- Course Details (Step 2): { \"courseType\": \"...\", \"subject\": \"...\", \"courseName\": \"...\", \"description\": \"...\", \"price\": \"...\", \"duration\": \"...\", \"requirements\": \"...\", \"level\": \"...\", \"language\": \"...\", \"scriptingLanguage\": \"...\", \"evaluator\": \"...\" }\n"
        "- Course Structure (Step 3): { \"modules\": [{ \"title\": \"...\", \"chapters\": [{\"title\": \"...\"}] }] }\n"
        "- Course Content (Step 4): { \"prompts\": [{ \"module\": \"...\", \"title\": \"...\", \"prompt\": \"...\" }] } OR { \"module\": \"...\", \"title\": \"...\", \"prompt\": \"...\" } for a single lesson.\n\n"
        "CRITICAL FOR SINGLE LESSONS & ALL LESSONS PROMPTS:\n"
        "1. When generating a prompt for a single lesson, you MUST include the \"module\" and \"title\" (lesson title) in the JSON so the application knows exactly where to apply it.\n"
        "2. STAGE 1 PROMPT GENERATION PRINCIPLE: You must generate a highly detailed AI content-generation prompt for the lesson. Do NOT generate actual lesson content, teacher notes, summaries, or lesson plans. The output is a prompt that will be consumed by another Stage 2 LLM to generate the actual lesson content.\n"
        "3. EACH GENERATED PROMPT MUST INSTRUCT THE STAGE 2 LLM TO MAP CONTENT INTO THESE 15 ALLOWED BLOCKS:\n"
        "   - Introduction / Core Concepts -> heading (level 1/2/3) and paragraph blocks.\n"
        "   - Learning Objectives -> bullet_list block.\n"
        "   - Vocabulary / Terminology / Key Terms -> table block containing columns [Word/Term, Definition/Meaning, Example Sentence].\n"
        "   - Worked Examples / Dialogue transcripts / Case Studies -> example block (scenario, detail) or code block.\n"
        "   - Step-by-step guidance / Steps -> numbered_list block.\n"
        "   - Code Snippets (if programming) -> code block (language, code, explanation).\n"
        "   - Quizzes & Knowledge Checks -> quiz and knowledge_check blocks (question, options, correctAnswer/answer, explanation).\n"
        "   - Assignments / Practical Tasks -> assignment block (task, instructions, grading_criteria).\n"
        "   - Summaries -> summary block (points).\n"
        "   - References / Further Reading -> reference block (title, url).\n"
        "4. SUBJECT-SPECIFIC BLOCK RULES:\n"
        "   - Language lessons: MUST instruct to use table blocks for vocabulary, paragraph blocks for dialogue/reading transcripts, and quiz blocks for comprehension.\n"
        "   - Programming lessons (Python, C, C++, Java, JavaScript, SQL, C#): MUST instruct to use code blocks for all syntax and implementation examples, assignment blocks for code debug tasks/projects, and paragraph blocks for code analysis.\n"
        "   - Mathematics/Physics lessons: MUST instruct to use paragraph blocks with LaTeX math notation \\( ... \\) or \\[ ... \\] for formulas, and example blocks for worked calculations/problems.\n"
        "   - Science lessons: MUST instruct to use numbered_list blocks for experiments, callout blocks for warnings/tips, and table blocks for observation data.\n"
        "   - Cybersecurity lessons: MUST instruct to use example blocks for threat scenarios and assignment blocks for security configurations.\n"
        "   - Business lessons: MUST instruct to use example blocks for case study details and table blocks for strategic analysis comparisons.\n"
        "5. Each individual prompt MUST be highly comprehensive, detailed, and extremely actionable (between 150 and 250 words) to ensure educational quality.\n"
        "6. PROMPT LINE SPACING RULE (CRITICAL): The text inside the \"prompt\" JSON field MUST be formatted with double newlines (\\n\\n) between its structural sections (e.g. separate Learning Objectives, Content Requirements, Engagement Requirements, and Subject Adaptation with double newlines) so it displays with neat line spacing when rendered in the UI.\n"
        "7. COMPLETE COVERAGE RULE (CRITICAL): You MUST generate prompts for EVERY SINGLE module and lesson present in the course structure. Never skip or omit any module or lesson, and do not truncate the output list before completion.\n"
        "8. CRITICAL FORMATTING INSTRUCTION: If you are returning any structured metadata (Details, Structure, or Content prompts), you MUST ALWAYS wrap the raw JSON object inside EXACTLY '[METADATA]' and '[/METADATA]' tags. NEVER return raw JSON outside these tags! For example: [METADATA]{\"prompts\": [...]}[/METADATA].\n"
        "9. YOU ARE STRICTLY FORBIDDEN from repeating the JSON block or displaying raw JSON/code blocks in the conversational reply text. Keep the conversational reply text purely conversational.\n\n"
        "VALID DROPDOWN OPTIONS (YOU MUST USE ONLY THESE):\n"
        "- courseType: Must be \"Custom Course\" or \"SCORM Course\"\n"
        "- subject: Must be EXACTLY one of: \"English\", \"Maths\", \"Science\", \"Social\", \"Physics\", \"Chemistry\", \"Biology\", \"History\", \"Geography\", \"Economics\", \"Computer Science\", \"Data Science\", \"Machine Learning\", \"AI\", \"Python Programming\", \"Digital Marketing\", \"Business Management\".\n"
        "- duration: Must be a NUMERIC string representing total hours (e.g., \"10\" for 10 hours). Do NOT include \"hours\" or \"hrs\".\n"
        "- level: Must be \"beginner\", \"intermediate\", or \"advanced\".\n"
        "- scriptingLanguage: Must be EXACTLY one of: \"NA\", \"Python\", \"SQL\", \"C++\", \"C\", \"MySQL\", \"PostgreSQL\", \"Java\", \"JavaScript\". CRITICAL: If the course topic, name, description, or subject is related to one of these programming/database options (e.g. Python, SQL, C++, C, MySQL, PostgreSQL, Java, JavaScript), you MUST set \"scriptingLanguage\" to that specific language (e.g. \"Java\" for Java programming, \"Python\" for Python/Data Science, etc.) instead of defaulting to \"NA\".\n"
        "- evaluator: Choose one from: \"Sarah Johnson\", \"Michael Chen\", \"Dr. Emily Smith\", \"Alex Rivera\"."
    )
    return system_prompt

def try_repair_truncated_json(s: str) -> str:
    """
    Attempts to repair a truncated JSON string by tracking unclosed container elements
    and closing them in the correct LIFO order.
    """
    s = s.strip()
    try:
        json.loads(s)
        return s
    except json.JSONDecodeError:
        pass
        
    stack = []
    in_string = False
    escaped = False
    clean_chars = []
    
    for i, char in enumerate(s):
        if in_string:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                in_string = False
            clean_chars.append(char)
        else:
            if char == '"':
                in_string = True
                clean_chars.append(char)
            elif char == '{':
                stack.append('{')
                clean_chars.append(char)
            elif char == '[':
                stack.append('[')
                clean_chars.append(char)
            elif char == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
                    clean_chars.append(char)
                else:
                    break
            elif char == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
                    clean_chars.append(char)
                else:
                    break
            else:
                clean_chars.append(char)
                
    prefix = "".join(clean_chars).strip()
    
    while prefix.endswith(',') or prefix.endswith(':'):
        prefix = prefix[:-1].strip()
        
    if in_string:
        prefix += '"'
        
    for container in reversed(stack):
        if container == '{':
            prefix += '}'
        elif container == '[':
            prefix += ']'
            
    try:
        json.loads(prefix)
        return prefix
    except json.JSONDecodeError:
        pass
        
    return s

def clean_metadata_string(s: str) -> str:
    """
    Strips markdown code block wraps and extracts the JSON block starting from 
    the first brace/bracket to the last brace/bracket.
    """
    if not s:
        return ""
    s = s.strip()
    
    # Remove markdown code block wraps like ```json and ```
    s = re.sub(r'^```[a-zA-Z]*\s*', '', s)
    s = re.sub(r'\s*```$', '', s)
    s = s.strip()
    
    # Additional cleanup for internal markdown fences
    s = re.sub(r'```json', '', s, flags=re.IGNORECASE)
    s = re.sub(r'```', '', s)
    s = s.strip()
    
    first_brace = s.find('{')
    first_bracket = s.find('[')
    
    if first_brace == -1 and first_bracket == -1:
        return s
        
    start_idx = min(first_brace, first_bracket) if (first_brace != -1 and first_bracket != -1) else (first_brace if first_brace != -1 else first_bracket)
    
    last_brace = s.rfind('}')
    last_bracket = s.rfind(']')
    
    end_idx = max(last_brace, last_bracket)
    if end_idx != -1 and end_idx > start_idx:
        return s[start_idx:end_idx + 1]
    else:
        return s[start_idx:]

def clean_reply_text(text: str) -> str:
    """
    Cleans the conversational reply text by removing leaked JSON blocks, 
    markdown code block wrappers, and any orphaned formatting.
    """
    if not text:
        return ""
        
    # Remove markdown code blocks labeled as json
    text = re.sub(r'```json[\s\S]*?```', '', text)
    
    # Remove any markdown code blocks containing JSON-like characters (curly braces/brackets)
    text = re.sub(r'```[\s\S]*?```', lambda m: '' if '{' in m.group(0) or '[' in m.group(0) else m.group(0), text)
    
    # Remove any raw JSON-like structures that might be left in the text
    def remove_json_structures(t: str) -> str:
        out = []
        i = 0
        n = len(t)
        while i < n:
            if t[i] == '{' or t[i] == '[':
                start_char = t[i]
                end_char = '}' if start_char == '{' else ']'
                stack = 1
                j = i + 1
                while j < n and stack > 0:
                    if t[j] == start_char:
                        stack += 1
                    elif t[j] == end_char:
                        stack -= 1
                    j += 1
                if stack == 0:
                    candidate = t[i:j]
                    if (start_char == '{' and ':' in candidate) or (start_char == '[' and ('{' in candidate or ',' in candidate)):
                        i = j
                        continue
            out.append(t[i])
            i += 1
        return "".join(out)

    text = remove_json_structures(text)

    # Clean up any remaining/orphaned markdown code block markers
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    
    # Clean up duplicate empty lines or whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def parse_metadata(ai_reply: str, scope: str, details: dict) -> tuple:
    """
    Parses and extracts metadata from the raw AI response, applying fallback defaults where needed.
    Returns (reply_text, metadata, type_val)
    """
    lower_reply = ai_reply.lower()
    
    tags_to_try = [
        ("[metadata]", "[/metadata]"),
        ("[meta data]", "[/meta data]"),
        ("[meta_data]", "[/meta_data]"),
        ("[metadata_block]", "[/metadata_block]")
    ]
    
    start_idx = -1
    end_idx = -1
    start_tag_matched = ""
    end_tag_matched = ""
    
    for start_tag, end_tag in tags_to_try:
        idx = lower_reply.find(start_tag)
        if idx != -1:
            start_idx = idx
            start_tag_matched = start_tag
            end_tag_matched = end_tag
            # Try to find corresponding end tag
            e_idx = lower_reply.find(end_tag, start_idx + len(start_tag))
            if e_idx != -1:
                end_idx = e_idx
            break
            
    metadata_str = None
    text_part = ""
    
    if start_idx != -1:
        content_start = start_idx + len(start_tag_matched)
        if end_idx != -1:
            metadata_str = ai_reply[content_start:end_idx]
            text_part = ai_reply[:start_idx] + ai_reply[end_idx + len(end_tag_matched):]
        else:
            metadata_str = ai_reply[content_start:]
            text_part = ai_reply[:start_idx]
    else:
        # Fallback: search for first JSON curly brace or bracket
        first_brace = ai_reply.find('{')
        first_bracket = ai_reply.find('[')
        if first_brace != -1 or first_bracket != -1:
            start_idx = min(first_brace, first_bracket) if (first_brace != -1 and first_bracket != -1) else (first_brace if first_brace != -1 else first_bracket)
            fallback_str = ai_reply[start_idx:]
            # Truncate anything after the last curly brace or bracket to keep only valid JSON structure
            last_brace = fallback_str.rfind('}')
            last_bracket = fallback_str.rfind(']')
            if last_brace != -1 or last_bracket != -1:
                end_idx = max(last_brace, last_bracket) + 1
                metadata_str = fallback_str[:end_idx]
            else:
                metadata_str = fallback_str
            text_part = ai_reply[:start_idx]
            
    reply_text = text_part
    for start_tag, end_tag in tags_to_try:
        reply_text = reply_text.replace(start_tag.upper(), '') \
                               .replace(end_tag.upper(), '') \
                               .replace(start_tag.lower(), '') \
                               .replace(end_tag.lower(), '')
    reply_text = reply_text.strip()
    
    if not metadata_str and not reply_text:
        reply_text = ai_reply
        for start_tag, end_tag in tags_to_try:
            reply_text = reply_text.replace(start_tag.upper(), '') \
                                   .replace(end_tag.upper(), '') \
                                   .replace(start_tag.lower(), '') \
                                   .replace(end_tag.lower(), '')
        reply_text = reply_text.strip()

    metadata = None
    type_val = None

    if metadata_str:
        try:
            cleaned_str = clean_metadata_string(metadata_str)
            repaired_str = try_repair_truncated_json(cleaned_str)
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

    if reply_text:
        reply_text = clean_reply_text(reply_text)

    return reply_text, metadata, type_val
