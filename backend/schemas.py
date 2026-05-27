from pydantic import BaseModel, Field
from typing import List, Optional

class CourseDetails(BaseModel):
    courseType: Optional[str] = "Custom Course"
    subject: str
    courseName: str
    description: str
    price: Optional[str] = ""
    duration: str
    requirements: Optional[str] = ""
    level: Optional[str] = "beginner"
    language: Optional[str] = "English"
    scriptingLanguage: Optional[str] = "NA"
    bannerImage: Optional[str] = None
    evaluator: Optional[str] = ""

class ChapterStructure(BaseModel):
    title: str

class ModuleStructure(BaseModel):
    title: str
    chapters: List[ChapterStructure]

class CourseStructureRequest(BaseModel):
    source_type: str  # "external" or "internal"
    details: CourseDetails

class CourseStructureResponse(BaseModel):
    modules: List[ModuleStructure]

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str

class CourseQuiz(BaseModel):
    questions: List[QuizQuestion]

class TableSpec(BaseModel):
    caption: Optional[str] = None
    headers: List[str]
    rows: List[List[str]]

class ReferenceSpec(BaseModel):
    title: str
    url: str
    description: Optional[str] = None

class ChapterContent(BaseModel):
    title: str
    content_type: str = "ai_generated" # ai_generated, video, document, html
    explanation: Optional[str] = None
    html_content: Optional[str] = None
    example: Optional[str] = None
    code: Optional[str] = None
    summary: Optional[str] = None
    video_url: Optional[str] = None
    document_url: Optional[str] = None
    tables: Optional[List[TableSpec]] = None
    references: Optional[List[ReferenceSpec]] = None

class GenerateFlashcardsRequest(BaseModel):
    text: str
    
class GenerateMCQRequest(BaseModel):
    course_title: str
    module_title: str
    chapter_title: Optional[str] = None
    assessment_text: Optional[str] = None
    
class GenerateAssessmentRequest(BaseModel):
    course_title: str
    module_title: str
    assessment_text: Optional[str] = None
    
class MCQItem(BaseModel):
    question: str
    options: List[str]
    answer: str
    
class MCQResponse(BaseModel):
    mcqs: List[MCQItem]

class GenerateContentRequest(BaseModel):
    course_title: str
    module_title: str
    chapter_title: str
    source_type: str
    audience: str
    difficulty: str
    objectives: List[str]

class GenerateQuizRequest(BaseModel):
    course_title: str
    modules: List[dict]
    source_type: str
    audience: str
    difficulty: str
    objectives: List[str]

# For regenerating specific things
class RegenerateRequest(BaseModel):
    course_title: str
    module_title: str
    chapter_title: str
    source_type: str
    audience: str
    difficulty: str
    objectives: List[str]
    regenerate_type: str # "full" or "quiz"

# --- Online Course Generator schemas ---

class OutlineRequest(BaseModel):
    courseName: str = Field(..., description="Title of the course")
    description: str = Field(..., description="Brief description of the course")
    level: str = Field(..., description="Difficulty (beginner|intermediate|advanced)")
    subject: str = Field(..., description="Subject of the course")

class LessonContent(BaseModel):
    explanation: str
    examples: List[str]
    key_points: List[str]

class LessonRequest(BaseModel):
    title: str
    module_title: str
    prompt: str
    type: str = "html"
    course_details: Optional[CourseDetails] = None

class VoiceScriptResponse(BaseModel):
    voice_script: str

class ImagePromptResponse(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: Optional[str] = None

class StoreCourseRequest(BaseModel):
    course_json: dict

class QuizRequest(BaseModel):
    course_title: str
    modules: List[dict]
    sourceType: Optional[str] = "external"
    course_details: Optional[CourseDetails] = None

class PendingJob(BaseModel):
    moduleIdx: int
    lessonIdx: int
    moduleTitle: str
    chapterTitle: str

class GenerateAsyncRequest(BaseModel):
    jobs: List[PendingJob]
    course_details: CourseDetails
    course_format: str = "html"
    source_type: str = "external"
    modules: List[dict]

class GenerateTitleRequest(BaseModel):
    description: str

class GenerateTitleResponse(BaseModel):
    title: str

class FetchWebRequest(BaseModel):
    url: str

class FetchYouTubeRequest(BaseModel):
    youtube_url: str

class GenerateOutlineBaseRequest(BaseModel):
    description: str
    modules_count: int
    chapters_per_module: int
    assessments_per_module: int

class GenerateVoiceScriptReq(BaseModel):
    text: str

class ExportChapterRequest(BaseModel):
    course_title: str
    module_title: str
    chapter_title: str
    content: dict
    format: str # 'pdf', 'pptx', 'txt', 'mp4'

class ChatRequest(BaseModel):
    messages: list
    scope: str = "Course Details"
    details: Optional[dict] = {}
    courseData: Optional[dict] = {}
    availableSubjects: Optional[list] = []

