from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
from schemas import (
    CourseStructureRequest,
    GenerateTitleRequest, GenerateTitleResponse, FetchWebRequest, FetchYouTubeRequest,
    GenerateOutlineBaseRequest, ExportChapterRequest, GenerateVoiceScriptReq, GenerateFlashcardsRequest,
    GenerateMCQRequest, GenerateAssessmentRequest, ChatRequest, ThemeUploadRequest,
    ChatbotBuilderRequest
)
from course_planner import generate_course_structure
from content_generator import generate_chapter_content, generate_course_quiz

from rag_pipeline import ingest_document
from course_store import save_course, get_courses, get_course, update_course, delete_course
from database import save_course_to_mysql
import os
import shutil
import json
from dotenv import load_dotenv
import logging
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

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

def validate_uploaded_file(file: UploadFile, max_size_mb: float, allowed_extensions: list[str]):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"File extension '{ext}' is not allowed. Supported formats: {', '.join(allowed_extensions)}"
        )
    
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    max_size_bytes = max_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the limit of {max_size_mb}MB. Got {file_size / (1024 * 1024):.2f}MB."
        )

@app.get("/")
def read_root():
    return {"message": "AI Course Builder API is running"}

@app.post("/course/upload-doc")
async def upload_doc(file: UploadFile = File(...)):
    validate_uploaded_file(file, 10.0, ['.pdf', '.docx', '.txt', '.pptx', '.doc'])
    temp_file = file.filename
    try:
        with open(temp_file, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        chunks_count = ingest_document(temp_file, file.filename)
        
        if os.path.exists(temp_file):
            os.remove(temp_file)
            
        return {"status": "success", "chunks_processed": chunks_count}
    except Exception as e:
        if 'temp_file' in locals() and os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/structure")
async def create_structure(req: CourseStructureRequest):
    structure = generate_course_structure(
        req.details.courseName,
        req.details.description,
        req.details.subject,
        req.details.level
    )
    return {"status": "success", "data": structure}

async def auto_generate_dalle_image(chapter_title: str, explanation: str) -> Optional[str]:
    import requests
    import uuid
    import os
    try:
        visual_prompt = (
            f"A clean professional educational illustration, workflow flow chart, or concept diagram explaining '{chapter_title}'. "
            f"Style: clean modern infographic, dark theme, high vector graphics, highly informative, no text typos."
        )
        response = openai_client.images.generate(
            model="gpt-image-2",
            prompt=visual_prompt[:1000],
            n=1,
            size="1024x1024",
            quality="low"
        )
        logger.info(f"Image response: {response}")
        img_data = None
        first_item = response.data[0]
        
        url_val = getattr(first_item, 'url', None)
        b64_val = getattr(first_item, 'b64_json', None)
        
        if b64_val:
            import base64
            img_data = base64.b64decode(b64_val)
        elif url_val and url_val != "None":
            img_data = requests.get(url_val, timeout=20).content
        else:
            raise ValueError(f"No valid image URL or b64_json found in response: {first_item}")

        unique_filename = f"dalle_{uuid.uuid4().hex[:8]}.png"
        os.makedirs("uploads", exist_ok=True)
        file_path = os.path.join("uploads", unique_filename)
        with open(file_path, "wb") as f:
            f.write(img_data)
        
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return f"{base_url}/uploads/{unique_filename}"
    except Exception as e:
        logger.error(f"Failed to auto generate DALL-E visual for {chapter_title}: {e}")
        return None



@app.post("/course/create")
async def finalize_course(course: dict):
    from uuid import uuid4
    cid = course.get("id") or str(uuid4())
    try:
        logger.warning("Saving course to deprecated JSON file storage.")
        try:
            save_course(cid, course)
        except Exception as json_err:
            logger.error(f"Error saving to JSON storage: {json_err}")
            
        # Also save to MySQL and capture the generated ID
        try:
            mysql_course_id = save_course_to_mysql(course)
        except Exception as db_err:
            logger.error(f"Course saved to JSON but MySQL sync failed: {db_err}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_err)}")
        return {"status": "success", "course_id": cid, "mysql_course_id": mysql_course_id}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.put("/course/{course_id}")
async def edit_course(course_id: str, course: dict):
    try:
        logger.warning("Updating course in deprecated JSON file storage.")
        try:
            update_course(course_id, course)
        except Exception as json_err:
            logger.error(f"Error updating JSON storage: {json_err}")
            
        # Also update MySQL
        try:
            save_course_to_mysql(course)
        except Exception as db_err:
            logger.error(f"Course updated in JSON but MySQL sync failed: {db_err}")
            
        return {"status": "success", "course_id": course_id}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.delete("/course/{course_id}")
async def remove_course(course_id: str):
    delete_course(course_id)
    return {"status": "success"}

@app.get("/courses")
async def list_courses():
    try:
        from database import get_courses_from_mysql
        courses = get_courses_from_mysql()
        # Merge in any locally-saved JSON courses that are not in MySQL
        try:
            json_courses = get_courses()
            seen_ids = {str(c.get("id")) for c in courses if c.get("id") is not None}
            for jc in json_courses:
                if str(jc.get("id")) not in seen_ids:
                    courses.append(jc)
        except Exception:
            pass
        return {"courses": courses}
    except Exception as e:
        logger.error(f"Error fetching from MySQL: {e}")
        logger.warning("MySQL failed. Falling back to deprecated courses.json storage.")
        courses = get_courses()
        return {"courses": courses}

@app.get("/subjects")
async def list_subjects():
    try:
        from database import get_all_subjects_from_mysql
        subjects = get_all_subjects_from_mysql()
        return {"status": "success", "subjects": subjects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/course/themes")
def get_themes():
    themes_file = "themes.json"
    if not os.path.exists(themes_file):
        return []
    try:
        with open(themes_file, "r", encoding="utf-8") as f:
            import json
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading themes: {str(e)}")

@app.post("/course/theme")
def save_theme(req: ThemeUploadRequest):
    themes_file = "themes.json"
    
    allowed_keys = {
        "--bg-primary", "--bg-secondary", "--text-main", "--text-secondary", 
        "--text-muted", "--border-color", "--accent-color", "--accent-bg", 
        "--code-bg", "--code-text", "--theme-shadow",
        "--font-family", "--font-size-base", "--font-size-h1", "--font-size-h2",
        "--font-size-h3", "--line-height", "--block-spacing"
    }
    
    if not req.variables:
        raise HTTPException(status_code=400, detail="Variables mapping cannot be empty.")
        
    for k, v in req.variables.items():
        if k not in allowed_keys:
            raise HTTPException(status_code=400, detail=f"Invalid variable key '{k}'. Allowed keys: {', '.join(allowed_keys)}")
            
        v_str = str(v).strip()
        if ";" in v_str or "}" in v_str or "<" in v_str or ">" in v_str:
             raise HTTPException(status_code=400, detail=f"Invalid characters in value for key '{k}'.")
    
    themes_list = []
    if os.path.exists(themes_file):
        try:
            with open(themes_file, "r", encoding="utf-8") as f:
                import json
                themes_list = json.load(f)
        except Exception:
            themes_list = []
            
    themes_list = [t for t in themes_list if t.get("id") != req.id]
    
    new_theme = {
        "id": req.id,
        "name": req.name,
        "variables": req.variables
    }
    themes_list.append(new_theme)
    
    try:
        with open(themes_file, "w", encoding="utf-8") as f:
            import json
            json.dump(themes_list, f, indent=2)
        return {"status": "success", "theme_id": req.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving theme: {str(e)}")

@app.get("/course/{course_id}")
async def get_single_course(course_id: str):
    try:
        from database import get_course_details_from_mysql
        # Convert string ID to int if it's numeric
        cid = int(course_id) if course_id.isdigit() else None
        
        if cid:
            course = get_course_details_from_mysql(cid)
            if course:
                return {"status": "success", "course": course}
        
        # Fallback to JSON if not found in MySQL
        logger.warning("Course not found in MySQL. Falling back to deprecated JSON file storage lookup.")
        from course_store import get_course
        course = get_course(course_id)
        if course:
            return {"status": "success", "course": course}
            
        raise HTTPException(status_code=404, detail="Course not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/generate-title", response_model=GenerateTitleResponse)
async def api_generate_title(req: GenerateTitleRequest):
    from content_generator import generate_brief_title
    title = generate_brief_title(req.description)
    return {"title": title}

@app.post("/course/upload-thumbnail")
async def upload_thumbnail(file: UploadFile = File(...)):
    validate_uploaded_file(file, 5.0, ['.jpg', '.jpeg', '.png', '.gif', '.webp'])
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
    
    unique_filename = f"tts_{uuid.uuid4()}.mp3"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        response = openai_client.audio.speech.create(
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
    
    try:
        completion = openai_client.beta.chat.completions.parse(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful educational AI. Generate exactly 5 flashcards from the provided text."},
                {"role": "user", "content": f"Text:\n{req.text[:2000]}"}
            ],
            response_format=FlashcardsResponse
        )
        return {"status": "success", "flashcards": completion.choices[0].message.parsed.model_dump().get("flashcards")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def convert_to_pdf_if_needed(file_path: str) -> str:
    import platform
    import subprocess
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt']:
        # Find LibreOffice binary
        libreoffice_bin = "soffice"  # Default in Linux/AWS PATH
        if platform.system() == "Windows":
            # Common Windows paths for LibreOffice
            possible_paths = [
                r"C:\Program Files\LibreOffice\program\soffice.exe",
                r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    libreoffice_bin = p
                    break
        
        # Output directory is 'uploads'
        out_dir = "uploads"
        
        # Execute headless LibreOffice conversion
        cmd = [libreoffice_bin, "--headless", "--convert-to", "pdf", "--outdir", out_dir, file_path]
        try:
            logger.info(f"Converting {file_path} to PDF using command: {' '.join(cmd)}")
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            
            # The converted file has the same name but with .pdf extension
            pdf_filename = os.path.splitext(os.path.basename(file_path))[0] + ".pdf"
            pdf_path = os.path.join(out_dir, pdf_filename)
            
            if os.path.exists(pdf_path):
                # Delete original file
                if os.path.exists(file_path):
                    os.remove(file_path)
                return pdf_path
        except Exception as err:
            logger.error(f"LibreOffice conversion failed: {err}")
            # If conversion fails, keep original file
            
    return file_path

@app.post("/course/upload-media")
async def upload_media(file: UploadFile = File(...)):
    validate_uploaded_file(file, 10.0, ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mp3', '.wav', '.pdf', '.docx', '.txt', '.pptx', '.xlsx', '.xls', '.ppt', '.doc'])
    import uuid
    import shutil
    
    extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join("uploads", unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Convert Office documents to PDF so they can open securely in SecureDocViewer
        final_file_path = convert_to_pdf_if_needed(file_path)
        final_filename = os.path.basename(final_file_path)
        
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        return {"status": "success", "url": f"{base_url}/uploads/{final_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/course/list-media")
async def list_media():
    try:
        uploads_dir = "uploads"
        if not os.path.exists(uploads_dir):
            return {"status": "success", "files": []}
        
        base_url = os.getenv("PUBLIC_ASSET_URL", "http://localhost:8000")
        files_list = []
        for filename in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, filename)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                files_list.append({
                    "filename": filename,
                    "url": f"{base_url}/uploads/{filename}",
                    "size": stat.st_size,
                    "created_at": stat.st_mtime
                })
        
        files_list.sort(key=lambda x: x["created_at"], reverse=True)
        return {"status": "success", "files": files_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/mcq")
async def generate_mcqs(req: GenerateMCQRequest):
    try:
        from schemas import MCQResponse
        prompt = f"""You are an expert educator. Generate exactly 5 multiple-choice questions (each with 4 options) that test understanding for the following context.
Course: {req.course_title}
Module: {req.module_title}
Chapter: {req.chapter_title or 'General'}
Assessment Guidelines: {req.assessment_text or 'None'}"""

        completion = openai_client.beta.chat.completions.parse(
            model=LLM_MODEL,
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
    try:
        from schemas import MCQResponse
        prompt = f"""You are an expert educator. Generate exactly 10 multiple-choice questions (each with 4 options) that form a comprehensive assessment for the following module.
Course: {req.course_title}
Module: {req.module_title}
Assessment Guidelines: {req.assessment_text or 'None'}"""

        completion = openai_client.beta.chat.completions.parse(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": prompt},
            ],
            response_format=MCQResponse
        )
        return {"status": "success", "mcqs": completion.choices[0].message.parsed.model_dump().get("mcqs")}
    except Exception as e:
        logger.error(f"Error generating assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/course/auto-fill")
async def api_auto_fill():
    from content_generator import generate_course_details_from_context
    details = generate_course_details_from_context()
    if not details:
        raise HTTPException(status_code=400, detail="No source documents found. Please upload documents in Step 1 first.")
    return {"status": "success", "details": details}

@app.post("/course/chat")
async def api_chat(req: ChatRequest):
    from chat_service import build_system_prompt, parse_metadata

    logger.info(f"Chat request received. Scope: {req.scope}, Details: {req.details}")

    system_prompt = build_system_prompt(
        scope=req.scope,
        details=req.details,
        course_data=req.courseData,
        available_subjects=req.availableSubjects
    )

    messages = [{"role": "system", "content": system_prompt}] + req.messages

    try:
        response = openai_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=6000
        )
        
        # Log token usage
        if hasattr(response, "usage") and response.usage:
            logger.info(f"Token usage - Prompt: {response.usage.prompt_tokens}, Completion: {response.usage.completion_tokens}, Total: {response.usage.total_tokens}")

        ai_reply = response.choices[0].message.content

        reply_text, metadata, type_val = parse_metadata(
            ai_reply=ai_reply,
            scope=req.scope,
            details=req.details
        )

        return {
            "status": "success",
            "reply": reply_text,
            "metadata": metadata,
            "type": type_val
        }
    except Exception as e:
        logger.error(f"Error in chat completion API: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/course/chatbot-builder/chat")
async def api_chatbot_builder_chat(req: ChatbotBuilderRequest):
    from chatbot_builder_service import build_builder_system_prompt, parse_quick_replies
    from chat_service import parse_metadata

    logger.info(f"Chatbot Builder request received. Step: {req.currentStep}")

    # -------------------------------------------------------------------------
    # OUTLINE_EDIT: Use a dedicated JSON-mode call to guarantee structure output
    # -------------------------------------------------------------------------
    is_outline_edit_req = False
    if req.currentStep == "OUTLINE_EDIT":
        user_message = ""
        if req.messages:
            for msg in reversed(req.messages):
                if msg.get("role") == "user":
                    user_message = msg.get("content", "")
                    break
        lowercase_msg = user_message.lower()
        confirm_words = ["yes", "continue", "looks good", "proceed", "generate", "correct", "confirm", "happy", "fine", "ok", "go ahead"]
        is_confirmation = any(w in lowercase_msg for w in confirm_words) and not any(neg in lowercase_msg for neg in ["not", "dont", "change", "add", "remove", "delete", "reduce"])
        if not is_confirmation:
            is_outline_edit_req = True

    if is_outline_edit_req:
        try:
            current_structure = req.courseData.get("structure", {})
            details = req.courseData.get("details", {})
            
            # Find the user's last edit request
            user_message = "Modify the outline"
            if req.messages:
                for msg in reversed(req.messages):
                    if msg.get("role") == "user":
                        user_message = msg.get("content", "")
                        break

            edit_prompt = f"""You are an expert curriculum designer.
Your task is to modify the current course outline based strictly on the user's request.

Course Details:
- Name: {details.get("courseName")}
- Subject: {details.get("subject")}
- Goal: {details.get("description")}
- Level: {details.get("level")}
- Duration: {details.get("duration")} Hours

Current Course Outline (JSON):
{json.dumps(current_structure, indent=2)}

User's Modification Request:
"{user_message}"

Rules:
- Apply the user's modification request (e.g. reduce to 2 modules, rename chapters, add a new module, etc.) directly on the current course outline.
- Output the ENTIRE updated course outline structure.
- Do NOT prepend numbers, chapter numbers, or index prefixes (like "Module 1", "Chapter 1 -", "1.1") to module or chapter titles.
- Keep other unchanged modules and chapters as they are.
- Output ONLY valid JSON conforming to the schema. No markdown code blocks, no text explanations.

Expected JSON output format exactly:
{{
  "next_step": "OUTLINE_EDIT",
  "modules": [
    {{
      "title": "Module Title",
      "chapters": [
        {{"title": "Chapter Title"}},
        {{"title": "Another Chapter Title"}}
      ]
    }}
  ]
}}"""

            response = openai_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": "You are a curriculum design expert. Output only valid JSON conforming to the schema. No markdown, no extra text."},
                    {"role": "user", "content": edit_prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )

            structure_json = json.loads(response.choices[0].message.content)
            structure_json["next_step"] = "OUTLINE_EDIT"

            return {
                "status": "success",
                "reply": "Here is the updated course structure outline. Please take a moment to review it. Would you like to make any further modifications, or are you happy with this outline?",
                "quickReplies": ["Confirm Outline", "Reduce modules", "Add new module", "Rename modules/chapters"],
                "metadata": structure_json,
                "type": "structure"
            }
        except Exception as e:
            logger.error(f"Error in OUTLINE_EDIT JSON modification: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    # -------------------------------------------------------------------------
    # All other steps: standard conversational slot-filling flow
    # -------------------------------------------------------------------------
    from chatbot_builder_service import (
        extract_slots_from_message,
        determine_next_step,
        build_builder_system_prompt,
        parse_quick_replies,
        reinject_quick_replies_into_history
    )
    from chat_service import parse_metadata

    try:
        # Extract user last message
        user_message = ""
        if req.messages:
            for msg in reversed(req.messages):
                if msg.get("role") == "user":
                    user_message = msg.get("content", "")
                    break

        # Map legacy details key/values to clean slot values
        details = req.courseData.get("details", {}) or {}
        current_slots = {
            "topic": details.get("topic") or details.get("subject") or details.get("courseName") or "",
            "learningGoal": details.get("learningGoal") or details.get("description") or "",
            "currentLevel": details.get("currentLevel") or details.get("level") or "",
            "learningStyle": details.get("learningStyle") or details.get("requirements") or "",
            "duration": details.get("duration") or "",
            "language": "English"
        }

        # Stage 1: Run NLU Slot Extraction
        updated_slots = extract_slots_from_message(user_message, current_slots)

        # Stage 2: Programmatic Dialog Solver
        next_step, validation_error = determine_next_step(req.currentStep, updated_slots, user_message)

        # Stage 3: Dynamic NLG Prompt Generation
        system_prompt = build_builder_system_prompt(next_step, updated_slots, validation_error)

        cleaned_history = reinject_quick_replies_into_history(req.messages, updated_slots)
        messages = [{"role": "system", "content": system_prompt}] + cleaned_history

        response = openai_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=4000
        )
        
        ai_reply = response.choices[0].message.content

        # Determine scope based on next_step
        scope = "Details"
        if next_step == "PROMPT_GEN":
            scope = "Content"
        elif next_step == "OUTLINE_EDIT":
            scope = "Structure"

        # Parse quick-replies lists first to prevent clean_reply_text in parse_metadata from stripping them
        ai_reply, quick_replies = parse_quick_replies(ai_reply)

        # Parse metadata suggestions
        reply_text, metadata, type_val = parse_metadata(
            ai_reply=ai_reply,
            scope=scope,
            details=updated_slots
        )

        # Overwrite or inject next_step and clean slots into details metadata block
        if next_step == "PROMPT_GEN":
            type_val = "content"
            if metadata:
                metadata["next_step"] = "CONFIRM_GENERATE"
            else:
                metadata = {
                    "next_step": "CONFIRM_GENERATE",
                    "prompts": []
                }
        elif next_step == "OUTLINE_EDIT":
            type_val = "structure"
            
            # If structure modules are empty, generate the initial outline using generate_course_structure!
            current_structure_modules = req.courseData.get("structure", {}).get("modules", [])
            if not current_structure_modules:
                try:
                    logger.info("Generating initial syllabus structure using generate_course_structure...")
                    structure_res = generate_course_structure(
                        courseName=updated_slots.get("topic") or "Custom Course",
                        description=updated_slots.get("learningGoal") or "Course Content",
                        subject=updated_slots.get("topic") or "General",
                        level=updated_slots.get("currentLevel") or "beginner"
                    )
                    modules = structure_res.get("modules", [])
                    metadata = {
                        "next_step": "OUTLINE_EDIT",
                        "modules": modules
                    }
                except Exception as structure_err:
                    logger.error(f"Failed to generate initial structure on the fly: {structure_err}")
                    metadata = {
                        "next_step": "OUTLINE_EDIT",
                        "modules": []
                    }
            else:
                if metadata:
                    metadata["next_step"] = "CONFIRM_GENERATE"
                else:
                    metadata = {
                        "next_step": "CONFIRM_GENERATE",
                        "modules": current_structure_modules
                    }
        else:
            if next_step == "CONFIRM_DETAILS":
                type_val = "details_card"
            else:
                type_val = "details"
            if metadata:
                metadata["next_step"] = next_step
                for k, v in updated_slots.items():
                    metadata[k] = v
            else:
                # Minimal fallback metadata so frontend receives step transitions & slot values
                metadata = {
                    "next_step": next_step,
                    **updated_slots
                }

        # Quick replies are already parsed and extracted above
        reply_text = reply_text.strip()

        logger.info(f"[Chatbot Solver] Step transition: {req.currentStep} -> {next_step} | Metadata: {metadata}")

        return {
            "status": "success",
            "reply": reply_text,
            "quickReplies": quick_replies,
            "metadata": metadata,
            "type": type_val
        }
    except Exception as e:
        logger.error(f"Error in chatbot builder completion API: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


from schemas import ChatbotDraftSaveRequest

# Draft database table startup init event
@app.on_event("startup")
def startup_db_init():
    try:
        from database import init_draft_table
        init_draft_table()
    except Exception as e:
        logger.error(f"Failed to auto-initialize drafts MySQL table: {e}")

# Get all drafts
@app.get("/course/chatbot-builder/drafts")
def api_get_chatbot_drafts():
    try:
        from database import get_chatbot_drafts
        drafts = get_chatbot_drafts()
        return {"status": "success", "drafts": drafts}
    except Exception as e:
        logger.error(f"Error fetching chatbot drafts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Get a specific draft
@app.get("/course/chatbot-builder/draft/{draft_id}")
def api_get_chatbot_draft(draft_id: str):
    try:
        from database import get_chatbot_draft
        draft = get_chatbot_draft(draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        return {"status": "success", "draft": draft}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching chatbot draft {draft_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Save or update a draft
@app.post("/course/chatbot-builder/draft")
def api_save_chatbot_draft(req: ChatbotDraftSaveRequest):
    try:
        from database import save_chatbot_draft
        save_chatbot_draft(
            draft_id=req.id,
            course_name=req.courseName,
            current_step=req.currentStep,
            course_data=req.courseData,
            messages=req.messages
        )
        return {"status": "success", "message": "Draft saved successfully"}
    except Exception as e:
        logger.error(f"Error saving chatbot draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Delete a draft
@app.delete("/course/chatbot-builder/draft/{draft_id}")
def api_delete_chatbot_draft(draft_id: str):
    try:
        from database import delete_chatbot_draft
        delete_chatbot_draft(draft_id)
        return {"status": "success", "message": "Draft deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting chatbot draft {draft_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from schemas import RenameDraftRequest

# Rename a draft
@app.post("/course/chatbot-builder/draft/{draft_id}/rename")
def api_rename_chatbot_draft(draft_id: str, req: RenameDraftRequest):
    try:
        from database import rename_chatbot_draft
        rename_chatbot_draft(draft_id, req.name)
        return {"status": "success", "message": "Draft renamed successfully"}
    except Exception as e:
        logger.error(f"Error renaming chatbot draft {draft_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))






