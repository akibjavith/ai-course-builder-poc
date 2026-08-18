import uuid
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union, Literal, Annotated

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

class LessonRequest(BaseModel):
    title: str
    module_title: str
    prompt: str
    type: str = "html"
    course_details: Optional[CourseDetails] = None
    draft_id: Optional[str] = None

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

class DownloadExternalImageRequest(BaseModel):
    url: str

class DownloadExternalAudioRequest(BaseModel):
    url: str

class GenerateAIImageRequest(BaseModel):
    prompt: str
    draft_id: Optional[str] = None

class GenerateAIAudioRequest(BaseModel):
    script: Optional[str] = None
    prompt: Optional[str] = None
    voice: Optional[str] = "nova"
    mode: Optional[str] = "verbatim"
    draft_id: Optional[str] = None

class StoreCourseRequest(BaseModel):
    course_json: dict

class FetchWebRequest(BaseModel):
    url: str

class FetchYouTubeRequest(BaseModel):
    youtube_url: str

class ChatRequest(BaseModel):
    messages: list
    scope: str = "Course Details"
    details: Optional[dict] = {}
    courseData: Optional[dict] = {}
    availableSubjects: Optional[list] = []


# --- Block-Based Lesson Content Schemas ---

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

class AudioBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["audio"] = "audio"
    url: Optional[str] = ""
    caption: str
    script: Optional[str] = None
    audio_source: Optional[str] = "ai_generated"
    voice: Optional[str] = None

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

LessonBlock = Annotated[
    Union[
        HeadingBlock,
        ParagraphBlock,
        BulletListBlock,
        NumberedListBlock,
        ImageBlock,
        VideoBlock,
        AudioBlock,
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


class UserCreate(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = ""
    role: Optional[str] = "user"


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = ""
    role: Optional[str] = "user"
    created_at: Optional[str] = ""


class ChatbotBuilderRequest(BaseModel):
    messages: list
    currentStep: str = "GATHER_DETAILS"
    courseData: Optional[dict] = {}
    draft_id: Optional[str] = None
    user_id: Optional[str] = "user_default"


class ChatbotDraftSaveRequest(BaseModel):
    id: str
    courseName: str
    currentStep: str
    courseData: dict
    messages: list
    touch_user_interaction: Optional[bool] = False
    user_id: Optional[str] = "user_default"


class RenameDraftRequest(BaseModel):
    name: str


class ChatbotDraftSummary(BaseModel):
    id: str
    userId: Optional[str] = "user_default"
    courseName: Optional[str] = ""
    currentStep: Optional[str] = ""
    bgStatus: Optional[str] = "idle"
    created_at: Optional[str] = ""
    updated_at: Optional[str] = ""


class ChatbotDraftsListResponse(BaseModel):
    status: str
    drafts: List[ChatbotDraftSummary]

