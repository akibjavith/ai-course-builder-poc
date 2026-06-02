from fastapi import APIRouter, HTTPException, BackgroundTasks
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
    LessonRequest, QuizRequest, GenerateAsyncRequest, StoreCourseRequest
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
    try:
        from content_generator import generate_chapter_content
        
        course_title = req.course_details.courseName if req.course_details else "the course"
        course_desc = req.course_details.description if req.course_details else ""
        subject = req.course_details.subject if req.course_details else "General"
        difficulty = req.course_details.level if req.course_details else "beginner"
        objectives = req.course_details.requirements if req.course_details else ""
        
        # We pass the prompt via the context or just update generate_chapter_content to handle it directly.
        # But we can just format our new dynamic prompt here!
        prompt_str = f"""
        Generate a COMPLETE, deep-dive lesson for '{req.title}' in the module '{req.module_title}' for the course '{course_title}'.
        Course Description: {course_desc}
        Subject: {subject}
        Difficulty: {difficulty}
        Audience: {objectives}
        
        CRITICAL INSTRUCTION:
        - Never output anything except a single JSON object.
        - The `code` value must contain ONLY the raw code snippet. Do NOT include any HTML buttons, copy code labels, markdown code block fences (like ```python), or surrounding HTML tags. The system will wrap it and generate the copy button automatically.
        - You MUST include a "tables" array. For topics that contain comparisons, classification vs regression, or algorithms comparison, generate a comparison table. Each table object must have:
          * "header": list of column names (e.g. ["Feature", "Supervised", "Unsupervised"])
          * "rows": list of rows, where each row is a list of strings matching the header length.
        - You MUST include a "references" array. Add 2-3 high-quality external resources/links with "title" and "url". To avoid 404 errors, do NOT hallucinate deep pages; instead, provide the official homepages of major trusted platforms or documentation (e.g., https://wikipedia.org, https://www.w3schools.com, https://scikit-learn.org, https://docs.python.org, https://developer.mozilla.org).
        
        CONTENT DEPTH REQUIREMENTS:
        - "concept": Write at least 4-5 detailed paragraphs explaining the topic in depth. Cover the WHY, HOW, and WHEN. Do NOT give just 2-3 sentences.
        - "example": Provide a comprehensive real-world scenario with specific details (names, numbers, context). At least 3-4 paragraphs.
        - "common_mistakes": List at least 5 common mistakes. Format each on its own line starting with a number like "1. mistake here\n2. mistake here".
        - "best_practices": List at least 5 best practices. Format each on its own line starting with a number like "1. practice here\n2. practice here".
        - "exercises": Provide at least 3 exercises. Format each on its own line starting with a number like "1. exercise here\n2. exercise here\n3. exercise here".
        - ALL list fields MUST use newline (\n) to separate each numbered item. Do NOT put multiple items on the same line.
        
        Return ONLY a JSON object:
        {{
            "title": "{req.title}",
            "concept": "...",
            "example": "...",
            "code": "...", 
            "code_explanation": "...",
            "tables": [
                {{
                    "header": ["Col1", "Col2"],
                    "rows": [
                        ["Val1", "Val2"]
                    ]
                }}
            ],
            "references": [
                {{"title": "...", "url": "..."}}
            ],
            "common_mistakes": "1. ...\n2. ...\n3. ...\n4. ...\n5. ...",
            "best_practices": "1. ...\n2. ...\n3. ...\n4. ...\n5. ...",
            "exercises": "1. ...\n2. ...\n3. ..."
        }}
        """
        
        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a senior AI architect and instructional designer."},
                {"role": "user", "content": prompt_str}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        lesson_data = json.loads(response.choices[0].message.content)
        
        def parse_markdown_bold_py(text: str) -> str:
            if not text:
                return ""
            import re
            text = str(text)
            text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
            text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
            # First, split inline numbered items like "blah 2. blah 3. blah" onto separate lines
            text = re.sub(r'(?<!\n)(\d+)\.\s+', r'\n\1. ', text)
            # Also split inline bullets
            text = re.sub(r'(?<!\n)[-•]\s+', r'\n- ', text)
            # Convert numbered lines (1. xxx) into ordered list
            lines = text.split('\n')
            in_ol = False
            in_ul = False
            result_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                numbered = re.match(r'^(\d+)\.\s+(.*)', stripped)
                bulleted = re.match(r'^[-•]\s+(.*)', stripped)
                if numbered:
                    if not in_ol:
                        if in_ul:
                            result_lines.append('</ul>')
                            in_ul = False
                        result_lines.append('<ol style="padding-left:20px;margin:10px 0;">')
                        in_ol = True
                    result_lines.append(f'<li style="margin-bottom:6px;">{numbered.group(2)}</li>')
                elif bulleted:
                    if not in_ul:
                        if in_ol:
                            result_lines.append('</ol>')
                            in_ol = False
                        result_lines.append('<ul style="list-style-type:disc;padding-left:20px;margin:10px 0;">')
                        in_ul = True
                    result_lines.append(f'<li style="margin-bottom:6px;">{bulleted.group(1)}</li>')
                else:
                    if in_ol:
                        result_lines.append('</ol>')
                        in_ol = False
                    if in_ul:
                        result_lines.append('</ul>')
                        in_ul = False
                    result_lines.append(f'<p style="margin:8px 0;">{stripped}</p>')
            if in_ol:
                result_lines.append('</ol>')
            if in_ul:
                result_lines.append('</ul>')
            return '\n'.join(result_lines)

        # Quick inline assembler
        def md_html(t):
            if isinstance(t, list):
                if len(t) > 0 and isinstance(t[0], dict):
                    res = "<ul style='padding-left: 20px;'>"
                    for item in t:
                        res += "<li style='margin-bottom: 12px;'>"
                        for k, v in item.items():
                            res += f"<strong>{k.replace('_', ' ').title()}:</strong> {parse_markdown_bold_py(str(v))}<br/>"
                        res += "</li>"
                    res += "</ul>"
                    return res
                else:
                    res = "<ol style='padding-left: 20px;'>"
                    for item in t:
                        res += f"<li style='margin-bottom: 8px;'>{parse_markdown_bold_py(str(item))}</li>"
                    res += "</ol>"
                    return res
            elif isinstance(t, dict):
                res = "<ul style='padding-left: 20px;'>"
                for k, v in t.items():
                    res += f"<li style='margin-bottom: 8px;'><strong>{k.replace('_', ' ').title()}:</strong> {parse_markdown_bold_py(str(v))}</li>"
                res += "</ul>"
                return res
            return parse_markdown_bold_py(str(t))

        # Build tables HTML
        tables_html = ""
        for tbl in (lesson_data.get('tables') or []):
            header = tbl.get("header", [])
            rows = tbl.get("rows", [])
            tables_html += "<div style='margin:30px 0;overflow-x:auto;'>"
            tables_html += "<h4 style='color:#0ea5e9;text-transform:uppercase;font-size:0.85rem;margin-bottom:10px;font-weight:bold;'>Comparison Table</h4>"
            tables_html += "<table style='width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;'>"
            if header:
                tables_html += "<thead><tr>" + "".join([f"<th style='border:1px solid rgba(128,128,128,0.3);padding:12px 15px;background:rgba(59,130,246,0.15);font-weight:bold;text-align:left;'>{h}</th>" for h in header]) + "</tr></thead>"
            tables_html += "<tbody>"
            for ri, row in enumerate(rows):
                bg = "rgba(128,128,128,0.05)" if ri % 2 == 0 else "transparent"
                tables_html += f"<tr style='background:{bg};'>" + "".join([f"<td style='border:1px solid rgba(128,128,128,0.2);padding:10px 15px;'>{c}</td>" for c in row]) + "</tr>"
            tables_html += "</tbody></table></div>"

        # Build references HTML
        refs_html = ""
        refs_list = lesson_data.get('references') or []
        if refs_list:
            refs_html = "<div style='margin:30px 0;padding:20px;background:rgba(37,99,235,0.05);border-radius:12px;border:1px solid rgba(37,99,235,0.2);'>"
            refs_html += "<h4 style='color:#2563eb;text-transform:uppercase;font-size:0.85rem;margin-bottom:10px;font-weight:bold;'>References & Further Reading</h4><ul style='padding-left:20px;'>"
            for ref in refs_list:
                refs_html += f"<li style='margin-bottom:8px;'><a href='{ref.get('url','#')}' target='_blank' rel='noopener noreferrer' style='color:#2563eb;text-decoration:underline;'>{ref.get('title','Reference')}</a></li>"
            refs_html += "</ul></div>"

        # Generate image first
        image_url = None
        try:
            prompt_resp = await generate_image_prompt({"lesson_text": str(lesson_data.get('concept', ''))})
            image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
            image_url = image_resp["image_url"]
        except Exception as img_err:
            print("Generate lesson auto-image failed", img_err)

        image_html = ""
        if image_url:
            image_html = f"""
            <div class="lesson-image" style="margin: 25px 0; text-align: center;">
                <img src="{image_url}" alt="{req.title}" style="max-width: 100%; max-height: 450px; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2);" />
            </div>
            """

        # Copy button JS embedded in HTML
        copy_btn_style = "position:absolute;top:10px;right:10px;background:rgba(30,41,59,0.95);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;z-index:10;"
        copy_btn_script = "onclick=\"(function(btn){var code=btn.parentElement.querySelector('code');if(code){navigator.clipboard.writeText(code.innerText).then(function(){btn.innerText='Copied!';btn.style.color='#22c55e';setTimeout(function(){btn.innerText='Copy Code';btn.style.color='#94a3b8';},2000);})};})(this)\""

        html_snippet = f"""
        <div class="lesson-snippet" style="font-family: 'Inter', sans-serif; line-height: 1.6; color: inherit;">
            <div style="margin-bottom: 35px; border-left: 4px solid #3b82f6; padding-left: 20px;">
                <h4 style="color: #3b82f6; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">The Core Concept</h4>
                <div style="font-size: 1.05rem;">{md_html(lesson_data.get('concept', ''))}</div>
                {image_html}
            </div>
            <div class="example" style="background: rgba(34, 197, 94, 0.1); border-left: 6px solid #22c55e; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h4 style="margin-top: 0; color: #22c55e; text-transform: uppercase; font-size: 0.85rem; font-weight: bold;">Professional Example</h4>
                <div style="color: inherit;">{md_html(lesson_data.get('example', ''))}</div>
            </div>
            {tables_html}
            <div style="margin: 30px 0;">
                <h4 style="color: #6366f1; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">Practical Implementation</h4>
                <div style="position:relative;">
                    <button {copy_btn_script} style="{copy_btn_style}">Copy Code</button>
                    <pre style="background: rgba(15, 23, 42, 0.8); color: #38bdf8; padding: 20px; padding-top: 45px; border-radius: 12px; overflow-x: auto;"><code>{lesson_data.get('code', '')}</code></pre>
                </div>
                <div style="margin-top: 15px; font-size: 0.95rem; opacity: 0.9; padding: 15px; background: rgba(128,128,128,0.1); border-radius: 8px;">{md_html(lesson_data.get('code_explanation', ''))}</div>
            </div>
            <div class="note" style="border-left: 6px solid #f97316; background: rgba(249, 115, 22, 0.1); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h4 style="margin-top: 0; color: #f97316; text-transform: uppercase; font-size: 0.85rem; font-weight: bold;">Critical Pitfalls</h4>
                <div style="color: inherit;">{md_html(lesson_data.get('common_mistakes', ''))}</div>
            </div>
            <div style="margin: 30px 0; background: rgba(128,128,128,0.05); padding: 25px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2);">
                <h4 style="color: #8b5cf6; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">Best Practices</h4>
                <div style="color: inherit;">{md_html(lesson_data.get('best_practices', ''))}</div>
            </div>
            <div style="margin: 30px 0; background: rgba(45, 212, 191, 0.05); padding: 25px; border-radius: 12px; border: 1px dashed rgba(45, 212, 191, 0.5);">
                <h4 style="color: #2dd4bf; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">Practice Exercises</h4>
                <div style="color: inherit;">{md_html(lesson_data.get('exercises', ''))}</div>
            </div>
            {refs_html}
        </div>
        """

        return {
            "content": html_snippet,
            "type": "html",
            "image_url": image_url,
            "tables": lesson_data.get('tables', []),
            "references": lesson_data.get('references', [])
        }
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

class VideoCompileRequest(BaseModel):
    image_url: str
    script_text: str

@router.post("/compile-video")
async def compile_video_endpoint(req: VideoCompileRequest):
    try:
        # Generate video dynamically using our new ffmpeg wrapper
        # Lazy import — only loaded when video compilation is requested
        from app.services.video_compiler import compile_video
        filename = f"compiled_lesson_{uuid.uuid4().hex[:8]}.mp4"
        video_url = compile_video(
            image_url=req.image_url, 
            lesson_text=req.script_text, 
            output_filename=filename
        )
        # Return the video path relative to the API host
        return {"video_url": video_url}
    except Exception as e:
        # Fallback
        raise HTTPException(status_code=500, detail=str(e))

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
async def async_course_worker(task_id: str, req: GenerateAsyncRequest):
    try:
        total_jobs = len(req.jobs)
        results = []
        for i, job in enumerate(req.jobs):
            TASK_STORE[task_id]["progress"] = int((i / total_jobs) * 90)
            TASK_STORE[task_id]["message"] = f"Generating content for {job.chapterTitle}..."
            
            # Try to find the prompt for this chapter in the modules
            chap_prompt = f"Explain {job.chapterTitle} deeply."
            for mod in req.modules:
                if mod.get("title") == job.moduleTitle:
                    for chap in mod.get("chapters", []):
                        if chap.get("title") == job.chapterTitle:
                            if chap.get("content") and chap["content"].get("prompt"):
                                chap_prompt = chap["content"]["prompt"]
                            break
            
            content = generate_chapter_content(
                course_title=req.course_details.courseName,
                module_title=job.moduleTitle,
                chapter_title=job.chapterTitle,
                source_type=req.source_type,
                audience=req.course_details.requirements,
                difficulty=req.course_details.level,
                objectives=[req.course_details.requirements],
                output_format=req.course_format
            )
            
            voice_script = None
            image_url = None
            video_url = None
            html_content = content.get("html_content")
            content_type = 'ai_generated'
            
            if req.course_format == 'video':
                TASK_STORE[task_id]["message"] = f"Generating audio & images for {job.chapterTitle}..."
                voice_resp = await generate_voice({"lesson_text": content.get("explanation", "")})
                prompt_resp = await generate_image_prompt({"lesson_text": content.get("explanation", "")})
                image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
                
                TASK_STORE[task_id]["message"] = f"Compiling MP4 for {job.chapterTitle}..."
                vreq = VideoCompileRequest(image_url=image_resp["image_url"], script_text=content.get("explanation", ""))
                video_resp = await compile_video_endpoint(vreq)
                
                voice_script = voice_resp["voice_script"]
                image_url = image_resp["image_url"]
                video_url = video_resp["video_url"]
                content_type = 'video'
            elif req.course_format == 'image':
                prompt_resp = await generate_image_prompt({"lesson_text": content.get("explanation", "")})
                image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
                image_url = image_resp["image_url"]
                content_type = 'image'
            elif req.course_format == 'html':
                content_type = 'html'
                try:
                    prompt_resp = await generate_image_prompt({"lesson_text": content.get("explanation", "")})
                    image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
                    image_url = image_resp["image_url"]
                except Exception as img_err:
                    print("Async worker auto-image failed", img_err)
                    image_url = None

            results.append({
                "module_title": job.moduleTitle,
                "title": job.chapterTitle,
                "content_type": content_type,
                "explanation": content.get("explanation", ""),
                "html_content": html_content,
                "examples": content.get("examples", []),
                "key_points": content.get("key_points", []),
                "tables": content.get("tables"),
                "references": content.get("references"),
                "voice_script": voice_script,
                "image_url": image_url,
                "video_url": video_url,
                "document_url": None
            })
            
        TASK_STORE[task_id]["progress"] = 90
        TASK_STORE[task_id]["message"] = "Generating Global Course Quiz..."
        
        quiz = None
        try:
            quiz = generate_course_quiz(
                course_title=req.course_details.courseName,
                modules=req.modules,
                source_type=req.source_type,
                audience=req.course_details.requirements, # Use requirements as audience context
                difficulty=req.course_details.level,
                objectives=req.course_details.requirements
            )
        except Exception:
            pass

        TASK_STORE[task_id]["progress"] = 100
        TASK_STORE[task_id]["status"] = "completed"
        TASK_STORE[task_id]["message"] = "All AI processing complete."
        TASK_STORE[task_id]["result"] = {
            "content": results,
            "quiz": quiz
        }

    except Exception as e:
        TASK_STORE[task_id]["status"] = "failed"
        TASK_STORE[task_id]["message"] = str(e)


@router.post("/generate-async")
async def generate_async(req: GenerateAsyncRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    TASK_STORE[task_id] = {
        "status": "running",
        "progress": 0,
        "message": "Initializing generation...",
        "result": None
    }
    background_tasks.add_task(async_course_worker, task_id, req)
    return {"task_id": task_id}

@router.get("/task-status/{task_id}")
async def task_status(task_id: str):
    if task_id not in TASK_STORE:
        raise HTTPException(status_code=404, detail="Task not found")
    return TASK_STORE[task_id]


# Removed duplicate list_courses endpoint; using main.py implementation.
