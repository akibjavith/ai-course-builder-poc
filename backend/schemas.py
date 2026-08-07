from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class CourseDetails(BaseModel):
    courseType: Optional[str] = "Custom Course"
    subject: str
    courseName: str
    description: str
    price: Optional[str] = ""
    duration: str
    learningHours: Optional[str] = None  # Instructional content hours (1–20); distinct from duration (days)
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
# --- Online Course Generator schemas ---

class OutlineRequest(BaseModel):
    courseName: str = Field(..., description="Title of the course")
    description: str = Field(..., description="Brief description of the course")
    level: str = Field(..., description="Difficulty (beginner|intermediate|advanced)")
    subject: str = Field(..., description="Subject of the course")

class LessonRequest(BaseModel):
    title: str
    module_title: str
    prompt: str
    type: str = "html"
    course_details: Optional[CourseDetails] = None
    draft_id: Optional[str] = None

class ImagePromptResponse(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: Optional[str] = None

class DownloadExternalImageRequest(BaseModel):
    url: str

class StoreCourseRequest(BaseModel):
    course_json: dict

class QuizRequest(BaseModel):
    course_title: str
    modules: List[dict]
    sourceType: Optional[str] = "external"
    course_details: Optional[CourseDetails] = None


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


# --- Block-Based Lesson Content Schemas ---
import uuid
from typing import Union, Literal

class HeadingBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["heading"] = "heading"
    level: int
    text: str

class ParagraphBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["paragraph"] = "paragraph"
    text: str

class BulletListBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["bullet_list"] = "bullet_list"
    items: List[str]

class NumberedListBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["numbered_list"] = "numbered_list"
    items: List[str]

class ImageBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["image"] = "image"
    url: Optional[str] = ""
    caption: str
    search_query: Optional[str] = None

class VideoBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["video"] = "video"
    url: str
    caption: str

class TableBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["table"] = "table"
    headers: List[str]
    rows: List[List[str]]

class CalloutBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["callout"] = "callout"
    text: str
    callout_type: str  # e.g., info, warning, tip, danger

class CodeBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["code"] = "code"
    language: str
    code: str
    explanation: str

class ExampleBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["example"] = "example"
    scenario: str
    detail: str

class QuizQuestionItem(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str
    explanation: Optional[str] = ""
    question_type: Optional[str] = "SINGLE CHOICE"

class QuizBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["quiz"] = "quiz"
    title: Optional[str] = "Knowledge Assessment"
    objective: Optional[str] = "Work through mixed question types in one quiz set. Each question scores independently."
    estimated_time: Optional[str] = "~3 min"
    questions: Optional[List[QuizQuestionItem]] = None
    # Top-level single question fields for backward compatibility
    question: Optional[str] = ""
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = ""
    explanation: Optional[str] = ""

class AssignmentBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["assignment"] = "assignment"
    task: str
    instructions: str
    grading_criteria: List[str]

class FlashcardItem(BaseModel):
    front: str
    back: str

class FlashcardBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["flashcard"] = "flashcard"
    title: Optional[str] = "Key Terminology & Flashcards"
    cards: List[FlashcardItem]

class SummaryBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["summary"] = "summary"
    points: List[str]

class ReferenceBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["reference"] = "reference"
    title: str
    url: str

from typing import Annotated

LessonBlock = Annotated[
    Union[
        HeadingBlock,
        ParagraphBlock,
        BulletListBlock,
        NumberedListBlock,
        ImageBlock,
        VideoBlock,
        TableBlock,
        CalloutBlock,
        CodeBlock,
        ExampleBlock,
        QuizBlock,
        AssignmentBlock,
        FlashcardBlock,
        SummaryBlock,
        ReferenceBlock
    ],
    Field(discriminator="type")
]

class LessonBlocksResponse(BaseModel):
    title: str
    blocks: List[LessonBlock]


class ThemeUploadRequest(BaseModel):
    id: str
    name: str
    variables: Dict[str, str]


class ChatbotBuilderRequest(BaseModel):
    messages: list
    currentStep: str = "GATHER_DETAILS"
    courseData: Optional[dict] = {}
    draft_id: Optional[str] = None


class ChatbotDraftSaveRequest(BaseModel):
    id: str
    courseName: str
    currentStep: str
    courseData: dict
    messages: list
    touch_user_interaction: Optional[bool] = False


class RenameDraftRequest(BaseModel):
    name: str







