import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from schemas import CourseStructureResponse

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

def generate_course_structure(courseName: str, description: str, subject: str, level: str) -> dict:
    llm = ChatOpenAI(model=LLM_MODEL, temperature=0.7)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert curriculum designer. Provide a structured JSON output of the course modules and chapters. The output must match the provided JSON schema exactly. CRITICAL: Do NOT prepend numbers, chapter numbers, or index prefixes (like '1.1', 'Module 1:', 'Chapter 1 -') to module or chapter titles in the generated schema. The UI handles ordering and numbering automatically."),
        ("user", "Create a course outline for deeply understanding:\nCourse Name: {name}\nDescription: {desc}\nSubject: {subject}\nLevel: {level}\nOutput strictly as JSON conforming to the schema.")
    ])
    
    chain = prompt | llm.with_structured_output(CourseStructureResponse)
    
    response = chain.invoke({
        "name": courseName,
        "desc": description,
        "subject": subject,
        "level": level
    })
    
    return response.model_dump()
