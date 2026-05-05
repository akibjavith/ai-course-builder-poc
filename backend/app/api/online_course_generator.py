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
from app.services.video_compiler import compile_video
from openai import OpenAI

client = OpenAI()

router = APIRouter(prefix="/course", tags=["online_course_generator"])

# In-memory store for async tasks: { task_id: { "status": str, "progress": int, "message": str, "result": any } }
TASK_STORE: Dict[str, Dict[str, Any]] = {}

class OutlineRequest(BaseModel):
    course_title: str = Field(..., description="Title of the course")
    description: str = Field(..., description="Brief description of the course")
    difficulty_level: str = Field(..., description="Difficulty (beginner|intermediate|advanced)")
    target_audience: str = Field(..., description="Intended audience")

class LessonContent(BaseModel):
    explanation: str
    examples: List[str]
    key_points: List[str]

class CourseDetailsDict(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    target_audience: Optional[str] = ""
    difficulty: Optional[str] = "beginner"
    learning_objectives: Optional[List[str]] = []

class LessonRequest(BaseModel):
    title: str
    module_title: str
    prompt: str
    type: str
    course_details: Optional[CourseDetailsDict] = None

class VoiceScriptResponse(BaseModel):
    voice_script: str

class ImagePromptResponse(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: str

class StoreCourseRequest(BaseModel):
    course_json: Dict[str, Any]

class QuizRequest(BaseModel):
    course_title: str
    modules: List[Dict[str, Any]]
    sourceType: Optional[str] = "external"
    audience: Optional[str] = "Everyone"
    difficulty: Optional[str] = "beginner"
    objectives: Optional[List[str]] = []

class PendingJob(BaseModel):
    moduleIdx: int
    lessonIdx: int
    moduleTitle: str
    chapterTitle: str

class GenerateAsyncRequest(BaseModel):
    jobs: List[PendingJob]
    course_title: str
    course_format: str
    source_type: str
    audience: str
    difficulty: str
    objectives: List[str]
    modules: List[Dict[str, Any]]

@router.post("/outline")
async def generate_outline(req: OutlineRequest):
    try:
        structure = generate_course_structure(
            title=req.course_title,
            description=req.description,
            audience=req.target_audience,
            difficulty=req.difficulty_level,
            duration=req.duration if hasattr(req, 'duration') else "Flexible",
            objectives=["Understand the fundamentals", "Apply concepts contextually"]
        )
        return structure
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lesson")
async def generate_lesson(req: LessonRequest):
    try:
        from content_generator import generate_chapter_content
        
        course_title = req.course_details.title if req.course_details else "the course"
        course_desc = req.course_details.description if req.course_details else ""
        audience = req.course_details.target_audience if req.course_details else "Everyone"
        difficulty = req.course_details.difficulty if req.course_details else "beginner"
        objectives = req.course_details.learning_objectives if req.course_details else []
        
        # We pass the prompt via the context or just update generate_chapter_content to handle it directly.
        # But we can just format our new dynamic prompt here!
        prompt_str = f"""
        Generate a COMPLETE, deep-dive lesson for '{req.title}' in the module '{req.module_title}' for the course '{course_title}'.
        Course Description: {course_desc}
        Target Audience: {audience}
        
        CRITICAL INSTRUCTION:
        {req.prompt}
        
        REQUIREMENTS:
        - No shallow content. Deep explanation (WHY + HOW).
        - Include a real-world example.
        - Include a 'practical_implementation' block. If the course is about programming (like Python, Java, HTML), provide code. If it's about Math, provide a formula/equation. If it's about Poetry, provide a poem stanza. If it's business, provide a framework or case study snippet.
        - Explain the practical implementation.
        - Use HTML Tables, Unordered Lists (ul), and Ordered Lists (ol) where appropriate.
        - Include at least one informative Link (a tag) to external documentation or further reading.
        - List common mistakes.
        - List best practices.
        - Provide 2-3 exercises.
        
        Return ONLY a JSON object:
        {{
            "title": "{req.title}",
            "concept": "...",
            "example": "...",
            "code": "...", 
            "code_explanation": "...",
            "common_mistakes": "...",
            "best_practices": "...",
            "exercises": "..."
        }}
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a senior AI architect and instructional designer."},
                {"role": "user", "content": prompt_str}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        lesson_data = json.loads(response.choices[0].message.content)
        
        # Quick inline assembler
        def md_html(t):
            if isinstance(t, list):
                if len(t) > 0 and isinstance(t[0], dict):
                    res = "<ul style='padding-left: 20px;'>"
                    for item in t:
                        res += "<li style='margin-bottom: 12px;'>"
                        for k, v in item.items():
                            res += f"<strong>{k.replace('_', ' ').title()}:</strong> {str(v).replace(chr(10), '<br/>')}<br/>"
                        res += "</li>"
                    res += "</ul>"
                    return res
                else:
                    res = "<ul style='list-style-type: disc; padding-left: 20px;'>"
                    for item in t:
                        res += f"<li style='margin-bottom: 8px;'>{str(item).replace(chr(10), '<br/>')}</li>"
                    res += "</ul>"
                    return res
            elif isinstance(t, dict):
                res = "<ul style='padding-left: 20px;'>"
                for k, v in t.items():
                    res += f"<li style='margin-bottom: 8px;'><strong>{k.replace('_', ' ').title()}:</strong> {str(v).replace(chr(10), '<br/>')}</li>"
                res += "</ul>"
                return res
            return str(t).replace('\n', '<br/>')

        html_snippet = f"""
        <div class="lesson-snippet" style="font-family: 'Inter', sans-serif; line-height: 1.6; color: inherit;">
            <div style="margin-bottom: 35px; border-left: 4px solid #3b82f6; padding-left: 20px;">
                <h4 style="color: #3b82f6; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">The Core Concept</h4>
                <div style="font-size: 1.05rem;">{md_html(lesson_data.get('concept', ''))}</div>
            </div>
            <div class="example" style="background: rgba(34, 197, 94, 0.1); border-left: 6px solid #22c55e; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h4 style="margin-top: 0; color: #22c55e; text-transform: uppercase; font-size: 0.85rem; font-weight: bold;">Professional Example</h4>
                <div style="color: inherit;">{md_html(lesson_data.get('example', ''))}</div>
            </div>
            <div style="margin: 30px 0;">
                <h4 style="color: #6366f1; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold;">Practical Implementation</h4>
                <pre style="background: rgba(15, 23, 42, 0.8); color: #38bdf8; padding: 20px; border-radius: 12px; overflow-x: auto;"><code>{lesson_data.get('code', '')}</code></pre>
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
        </div>
        """
        
        return {
            "content": html_snippet,
            "type": "html"
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
        response = client.chat.completions.create(
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
         response = client.chat.completions.create(
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
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt[:1000] if prompt else "Beautiful futuristic educational digital art.",
            n=1,
            size="1024x1024"
        )
        url = response.data[0].url
        
        # Download the image to avoid expiration
        import requests
        import uuid
        import os
        img_data = requests.get(url).content
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
        print("Dalle error", e)
        # Fallback to avoid complete pipeline failure
        return ImageResponse(image_url="https://via.placeholder.com/1024?text=Image+Generation+Failed").dict()

class VideoCompileRequest(BaseModel):
    image_url: str
    script_text: str

@router.post("/compile-video")
async def compile_video_endpoint(req: VideoCompileRequest):
    try:
        # Generate video dynamically using our new ffmpeg wrapper
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
            
            content = generate_chapter_content(
                course_title=req.course_title,
                module_title=job.moduleTitle,
                chapter_title=job.chapterTitle,
                source_type=req.source_type,
                audience=req.audience,
                difficulty=req.difficulty,
                objectives=req.objectives,
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

            results.append({
                "module_title": job.moduleTitle,
                "title": job.chapterTitle,
                "content_type": content_type,
                "explanation": content.get("explanation", ""),
                "html_content": html_content,
                "examples": content.get("examples", []),
                "key_points": content.get("key_points", []),
                "voice_script": voice_script,
                "image_url": image_url,
                "video_url": video_url,
                "document_url": None
            })
            
        TASK_STORE[task_id]["progress"] = 90
        TASK_STORE[task_id]["message"] = "Generating Global Course Quiz..."
        
        quiz = None
        try:
            qreq = QuizRequest(
                course_title=req.course_title,
                modules=req.modules,
                sourceType=req.source_type,
                audience=req.audience,
                difficulty=req.difficulty,
                objectives=req.objectives
            )
            quiz = await create_course_quiz(qreq)
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


# ── GET /courses ────────────────────────────────────────────────────────────
# The dashboard calls GET /courses to list all published courses.
from fastapi import APIRouter as _AR
_courses_router = APIRouter(prefix="", tags=["courses"])

@_courses_router.get("/courses")
async def list_courses():
    import json, os
    file_path = os.path.join(os.path.dirname(__file__), "..", "courses.json")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = []
    return {"courses": data}
