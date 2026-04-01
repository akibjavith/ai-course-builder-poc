from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
from schemas import CourseStructureRequest, GenerateContentRequest, RegenerateRequest, GenerateQuizRequest
from course_planner import generate_course_structure
from content_generator import generate_chapter_content, generate_course_quiz
from rag_pipeline import ingest_document
from course_store import save_course, get_courses, get_course
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
    cid = str(uuid4())
    save_course(cid, course)
    return {"status": "success", "course_id": cid}

@app.get("/courses")
async def list_courses():
    courses = get_courses()
    # Ensure dashboard always gets list under "courses" key
    return {"courses": courses}
