import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from schemas import CourseStructureResponse

def generate_course_structure(title: str, description: str, audience: str, difficulty: str, duration: str, objectives: list[str]) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert curriculum designer. Provide a structured JSON output of the course modules and chapters. The output must match the provided JSON schema exactly."),
        ("user", "Create a course outline for deeply understanding:\nTitle: {title}\nDescription: {desc}\nAudience: {aud}\nDifficulty: {diff}\nDuration: {dur}\nObjectives: {obj}\nOutput strictly as JSON conforming to the schema.")
    ])
    
    chain = prompt | llm.with_structured_output(CourseStructureResponse)
    
    response = chain.invoke({
        "title": title,
        "desc": description,
        "aud": audience,
        "diff": difficulty,
        "dur": duration,
        "obj": ", ".join(objectives)
    })
    
    return response.model_dump()
