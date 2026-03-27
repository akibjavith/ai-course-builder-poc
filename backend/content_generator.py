from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from schemas import ChapterContent, CourseQuiz
from rag_pipeline import retrieve_context

def generate_chapter_content(course_title, module_title, chapter_title, source_type, audience, difficulty, objectives) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5)
    
    context = ""
    if source_type == "internal":
        context = retrieve_context(chapter_title)
        
    prompt_str = """
    You are an expert technical writer and instructor.
    Write the content for the chapter '{chapter_title}' which is part of the module '{module_title}' in the course '{course_title}'.
    Target Audience: {audience}
    Difficulty: {difficulty}
    Course Objectives: {objectives}
    """
    
    if context:
        prompt_str += f"\nUse the following internal documentation context as your primary source of truth:\n{context}\n"
    else:
        prompt_str += "\nUse your internal knowledge to provide an in-depth, accurate explanation.\n"
        
    prompt_str += "\nOutput MUST be a JSON matching the required schema. If the domain is non-technical (e.g., medical, business), YOU MUST set the `code` and `example` fields to null. Never hallucinate code where not applicable."
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert educator. Output MUST exactly match the requested JSON schema. Do not include chapter-level quizzes."),
        ("user", prompt_str)
    ])
    
    chain = prompt | llm.with_structured_output(ChapterContent)
    
    response = chain.invoke({
        "course_title": course_title,
        "module_title": module_title,
        "chapter_title": chapter_title,
        "audience": audience,
        "difficulty": difficulty,
        "objectives": ", ".join(objectives)
    })
    
    return response.model_dump()

def generate_course_quiz(course_title, modules, source_type, audience, difficulty, objectives) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    
    context = ""
    if source_type == "internal":
        context = retrieve_context(course_title, k=6)

    prompt_str = """
    You are an expert educator. End of Course Global Assessment Quiz.
    Course Title: {course_title}
    Target Audience: {audience}
    Difficulty: {difficulty}
    Course Objectives: {objectives}
    List of Modules and Chapters:
    {modules_str}
    """
    
    if context:
        prompt_str += f"\nUse this core document context to frame questions:\n{context}\n"

    prompt_str += "\nCreate exactly 10 comprehensive multiple-choice questions covering the entire course material."

    mod_str = ""
    for idx, mod in enumerate(modules):
        mod_str += f"Module {idx+1}: {mod.get('title')}\n"
        for chap in mod.get('chapters', []):
             mod_str += f"  - {chap.get('title')}\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert educator. Match the exact CourseQuiz JSON schema."),
        ("user", prompt_str)
    ])

    chain = prompt | llm.with_structured_output(CourseQuiz)

    response = chain.invoke({
        "course_title": course_title,
        "audience": audience,
        "difficulty": difficulty,
        "objectives": ", ".join(objectives),
        "modules_str": mod_str
    })
    
    return response.model_dump()
