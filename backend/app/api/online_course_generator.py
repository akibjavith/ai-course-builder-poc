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

class LessonRequest(BaseModel):
    module_index: int
    lesson_index: int
    context: Optional[Dict[str, Any]] = None

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
        ctx = req.context or {}
        course_title = ctx.get("course_title", "Course")
        module_title = ctx.get("module_title", "Module")
        chapter_title = ctx.get("chapter_title", "Topic")
        source_type = ctx.get("sourceType", "external")
        audience = ctx.get("audience", "Everyone")
        difficulty = ctx.get("difficulty", "beginner")
        objectives = ctx.get("objectives", [])
        
        content = generate_chapter_content(
            course_title=course_title,
            module_title=module_title,
            chapter_title=chapter_title,
            source_type=source_type,
            audience=audience,
            difficulty=difficulty,
            objectives=objectives
        )
        return content
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
            
        # Return a relative path; the frontend will prepend its API_URL
        image_path = f"/uploads/{unique_filename}"
        return ImageResponse(image_url=image_path).dict()
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
                objectives=req.objectives
            )
            
            voice_script = None
            image_url = None
            video_url = None
            
            if req.course_format == 'video':
                TASK_STORE[task_id]["message"] = f"Generating audio & images for {job.chapterTitle}..."
                voice_resp = await generate_voice({"lesson_text": content.explanation})
                prompt_resp = await generate_image_prompt({"lesson_text": content.explanation})
                image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
                
                TASK_STORE[task_id]["message"] = f"Compiling MP4 for {job.chapterTitle}..."
                vreq = VideoCompileRequest(image_url=image_resp["image_url"], script_text=content.explanation)
                video_resp = await compile_video_endpoint(vreq)
                
                voice_script = voice_resp["voice_script"]
                image_url = image_resp["image_url"]
                video_url = video_resp["video_url"]
            elif req.course_format == 'image':
                prompt_resp = await generate_image_prompt({"lesson_text": content.explanation})
                image_resp = await generate_image({"prompt": prompt_resp["prompt"]})
                image_url = image_resp["image_url"]

            results.append({
                "module_title": job.moduleTitle,
                "title": job.chapterTitle,
                "content_type": 'ai_generated',
                "explanation": content.explanation,
                "examples": content.examples,
                "key_points": content.key_points,
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
