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
