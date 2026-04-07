from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
from schemas import (
    CourseStructureRequest, GenerateContentRequest, RegenerateRequest, GenerateQuizRequest,
    GenerateTitleRequest, GenerateTitleResponse, FetchWebRequest, FetchYouTubeRequest,
    GenerateOutlineBaseRequest, ExportChapterRequest, GenerateVoiceScriptReq, GenerateFlashcardsRequest,
    GenerateMCQRequest, GenerateAssessmentRequest
)
from course_planner import generate_course_structure
from content_generator import generate_chapter_content, generate_course_quiz
from rag_pipeline import ingest_document
from course_store import save_course, get_courses, get_course, update_course, delete_course
import os
import shutil
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Register online course generator router
from app.api.online_course_generator import router as ocg_router
app.include_router(ocg_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if not exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "AI Course Builder API is running"}

@app.post("/course/upload-doc")
async def upload_doc(file: UploadFile = File(...)):
    temp_file = file.filename
    try:
        with open(temp_file, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        chunks_count = ingest_document(temp_file, file.filename)
        
        if os.path.exists(temp_file):
            os.remove(temp_file)
            
        return {"status": "success", "chunks_processed": chunks_count}
    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/upload-media")
async def upload_media(file: UploadFile = File(...)):
    import uuid
    import shutil
    
    # Generate unique filename to avoid collision
    extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # We assume FastAPI runs on default localhost port, but relative URL /uploads/xxx is best
        return {"status": "success", "url": f"http://localhost:8000/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/structure")
async def create_structure(req: CourseStructureRequest):
    structure = generate_course_structure(
        req.details.title,
        req.details.description,
        req.details.target_audience,
        req.details.difficulty,
        req.details.duration,
        req.details.learning_objectives
    )
    return {"status": "success", "data": structure}

@app.post("/course/generate")
async def generate_chapter(req: GenerateContentRequest):
    content = generate_chapter_content(
        req.course_title,
        req.module_title,
        req.chapter_title,
        req.source_type,
        req.audience,
        req.difficulty,
        req.objectives
    )
    return {"status": "success", "content": content}

@app.post("/course/generate-quiz")
async def generate_quiz(req: GenerateQuizRequest):
    quiz = generate_course_quiz(
        req.course_title,
        req.modules,
        req.source_type,
        req.audience,
        req.difficulty,
        req.objectives
    )
    return {"status": "success", "quiz": quiz.get("questions", [])}

@app.post("/course/regenerate")
async def regenerate_chapter(req: RegenerateRequest):
    content = generate_chapter_content(
        req.course_title,
        req.module_title,
        req.chapter_title,
        req.source_type,
        req.audience,
        req.difficulty,
        req.objectives
    )
    return {"status": "success", "content": content}

@app.post("/course/create")
async def finalize_course(course: dict):
    from uuid import uuid4
    cid = course.get("id") or str(uuid4())
    try:
        save_course(cid, course)
        return {"status": "success", "course_id": cid}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.put("/course/{course_id}")
async def edit_course(course_id: str, course: dict):
    try:
        update_course(course_id, course)
        return {"status": "success", "course_id": course_id}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.delete("/course/{course_id}")
async def remove_course(course_id: str):
    delete_course(course_id)
    return {"status": "success"}

@app.get("/courses")
async def list_courses():
    courses = get_courses()
    # Ensure dashboard always gets list under "courses" key
    return {"courses": courses}

@app.post("/course/generate-title", response_model=GenerateTitleResponse)
async def api_generate_title(req: GenerateTitleRequest):
    from content_generator import generate_brief_title
    title = generate_brief_title(req.description)
    return {"title": title}

@app.post("/course/upload-thumbnail")
async def upload_thumbnail(file: UploadFile = File(...)):
    import uuid
    import shutil
    
    extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return {"status": "success", "url": f"{base_url}/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/fetch-web")
async def fetch_web(req: FetchWebRequest):
    import requests
    from bs4 import BeautifulSoup
    import uuid
    
    try:
        response = requests.get(req.url, timeout=10)
        soup = BeautifulSoup(response.content, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        
        unique_filename = f"{uuid.uuid4()}_web.txt"
        file_path = os.path.join("uploads", unique_filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
            
        chunks_count = ingest_document(file_path, unique_filename)
        return {"status": "success", "chunks_processed": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/fetch-youtube")
async def fetch_youtube(req: FetchYouTubeRequest):
    from youtube_transcript_api import YouTubeTranscriptApi
    import urllib.parse
    import uuid
    
    try:
        parsed_url = urllib.parse.urlparse(req.youtube_url)
        video_id = urllib.parse.parse_qs(parsed_url.query).get("v")
        if not video_id:
            # Handle youtu.be format
            video_id = [parsed_url.path.lstrip("/")]
        
        if not video_id:
            raise Exception("Invalid YouTube URL")
            
        transcript = YouTubeTranscriptApi.get_transcript(video_id[0])
        text = " ".join([t['text'] for t in transcript])
        
        unique_filename = f"{uuid.uuid4()}_youtube.txt"
        file_path = os.path.join("uploads", unique_filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
            
        chunks_count = ingest_document(file_path, unique_filename)
        return {"status": "success", "chunks_processed": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/generate-outline")
async def generate_outline(req: GenerateOutlineBaseRequest):
    from content_generator import generate_outline_skeleton
    structure = generate_outline_skeleton(req.description, req.modules_count, req.chapters_per_module)
    return {"status": "success", "data": structure}

@app.post("/course/export")
async def export_chapter(req: ExportChapterRequest):
    import uuid
    unique_filename = f"export_{uuid.uuid4()}"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        if req.format == "txt":
            file_path += ".txt"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(req.content.get("explanation", ""))
        elif req.format == "pdf":
            import pdfkit
            file_path += ".pdf"
            html_content = f"<h1>{req.chapter_title}</h1><p>{req.content.get('explanation', '')}</p>"
            # pdfkit requires wkhtmltopdf to be installed on system, this might fail if not present.
            # Using basic try-except. If wkhtmltopdf is not found, we can write a fallback.
            try:
                pdfkit.from_string(html_content, file_path)
            except OSError:
                file_path = file_path.replace(".pdf", ".txt")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(f"{req.chapter_title}\n\n{req.content.get('explanation', '')}")
        elif req.format == "pptx":
            from pptx import Presentation
            file_path += ".pptx"
            prs = Presentation()
            slide_layout = prs.slide_layouts[1] # Title and Content
            slide = prs.slides.add_slide(slide_layout)
            title = slide.shapes.title
            content = slide.placeholders[1]
            title.text = req.chapter_title
            content.text = req.content.get("explanation", "")[:500] + "..." # basic
            prs.save(file_path)
        else:
            raise Exception("Unsupported format")

        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return {"status": "success", "url": f"{base_url}/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/voice")
async def generate_voice(req: GenerateVoiceScriptReq):
    import uuid
    from openai import OpenAI
    
    unique_filename = f"tts_{uuid.uuid4()}.mp3"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=req.text
        )
        response.stream_to_file(file_path)
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return {"status": "success", "audio_url": f"{base_url}/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/flashcards")
async def generate_flashcards(req: GenerateFlashcardsRequest):
    from pydantic import BaseModel
    class FlashcardModel(BaseModel):
        question: str
        answer: str
    class FlashcardsResponse(BaseModel):
        flashcards: list[FlashcardModel]
    
    from openai import OpenAI
    client = OpenAI()
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful educational AI. Generate exactly 5 flashcards from the provided text."},
                {"role": "user", "content": f"Text:\n{req.text[:2000]}"}
            ],
            response_format=FlashcardsResponse
        )
        return {"status": "success", "flashcards": completion.choices[0].message.parsed.model_dump().get("flashcards")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/upload-media")
async def upload_media(file: UploadFile = File(...)):
    import uuid
    import shutil
    
    extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return {"status": "success", "url": f"{base_url}/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/mcq")
async def generate_mcqs(req: GenerateMCQRequest):
    from openai import OpenAI
    client = OpenAI()
    
    try:
        from schemas import MCQResponse
        prompt = f"""You are an expert educator. Generate exactly 5 multiple-choice questions (each with 4 options) that test understanding for the following context.
Course: {req.course_title}
Module: {req.module_title}
Chapter: {req.chapter_title or 'General'}
Assessment Guidelines: {req.assessment_text or 'None'}"""

        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
            ],
            response_format=MCQResponse
        )
        return {"status": "success", "mcqs": completion.choices[0].message.parsed.model_dump().get("mcqs")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/assessment")
async def generate_assessment(req: GenerateAssessmentRequest):
    from openai import OpenAI
    client = OpenAI()
    
    try:
        from schemas import MCQResponse
        prompt = f"""You are an expert educator. Generate exactly 10 multiple-choice questions (each with 4 options) that form a comprehensive assessment for the following module.
Course: {req.course_title}
Module: {req.module_title}
Assessment Guidelines: {req.assessment_text or 'None'}"""

        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
            ],
            response_format=MCQResponse
        )
        return {"status": "success", "mcqs": completion.choices[0].message.parsed.model_dump().get("mcqs")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
