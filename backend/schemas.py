from pydantic import BaseModel, Field
from typing import List, Optional

class CourseDetails(BaseModel):
    title: str
    description: str
    target_audience: str
    difficulty: str
    duration: str
    learning_objectives: List[str]

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

class ChapterContent(BaseModel):
    title: str
    content_type: str = "ai_generated" # ai_generated, video, document
    explanation: Optional[str] = None
    example: Optional[str] = None
    code: Optional[str] = None
    summary: Optional[str] = None
    video_url: Optional[str] = None
    document_url: Optional[str] = None

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
    context: Optional[dict] = None

class VoiceScriptResponse(BaseModel):
    voice_script: str

class ImagePromptResponse(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: str

class StoreCourseRequest(BaseModel):
    course_json: dict

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
