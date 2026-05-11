import mysql.connector
import os
import json
from dotenv import load_dotenv
from typing import Dict, Any

load_dotenv()

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "ai_course_db"),
        charset='utf8mb4',
        collation='utf8mb4_unicode_ci'
    )

# Mapping subject names to IDs (matching the frontend dropdown options)
SUBJECT_MAP = {
    "English": 1, "Maths": 2, "Science": 3, "Social": 4, "Physics": 5,
    "Chemistry": 6, "Biology": 7, "History": 8, "Geography": 9, "Economics": 10,
    "Computer Science": 11, "Data Science": 12, "Machine Learning": 13, "AI": 14,
    "Python Programming": 15, "Digital Marketing": 16, "Business Management": 17
}

def save_course_to_mysql(course_data: Dict[str, Any]):
    db_name = os.getenv("MYSQL_DB", "ai_course_db")
    print(f"DEBUG: Starting save_course_to_mysql to database: {db_name}...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        details = course_data.get("details", {})
        structure = course_data.get("structure", {})
        modules = structure.get("modules", [])
        
        print(f"DEBUG: Mapping course: {details.get('courseName')}")
        
        # 1. Dynamic Subject ID Lookup
        subject_name = details.get("subject", "General")
        print(f"DEBUG: Looking up ID for subject: {subject_name}")
        
        # Try to find matching subject in m_subject table
        cursor.execute("SELECT subject_id FROM m_subject WHERE subject_name = %s", (subject_name,))
        result = cursor.fetchone()
        
        if result:
            subject_id = result[0]
            print(f"DEBUG: Found Subject ID: {subject_id}")
        else:
            # Fallback: Just grab the first available subject ID so it doesn't crash
            print(f"DEBUG: Subject '{subject_name}' not found in m_subject. Using fallback...")
            cursor.execute("SELECT subject_id FROM m_subject LIMIT 1")
            fallback = cursor.fetchone()
            subject_id = fallback[0] if fallback else 1
            print(f"DEBUG: Using Fallback Subject ID: {subject_id}")
        
        course_sql = """
            INSERT INTO corp_course (
                course_name, course_desc, subject_id, course_price, script_lang, 
                no_of_days, requirements, course_level, course_language, active_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        course_vals = (
            details.get("courseName"),
            details.get("description"),
            subject_id,
            details.get("price") or 0,
            details.get("scriptingLanguage", "NA"),
            details.get("duration") or 30,
            details.get("requirements"),
            details.get("level"),
            details.get("language", "English"),
            1 # Active
        )
        
        cursor.execute(course_sql, course_vals)
        corp_course_id = cursor.lastrowid
        print(f"DEBUG: Inserted into corp_course. ID: {corp_course_id}")
        
        # 2. Insert into corp_course_conf
        conf_sql = """
            INSERT INTO corp_course_conf (
                course_conf_name, corp_course_id, track_flag, control_flow_flag
            ) VALUES (%s, %s, %s, %s)
        """
        cursor.execute(conf_sql, (f"{details.get('courseName')} Config", corp_course_id, 1, 1))
        corp_course_conf_id = cursor.lastrowid
        print(f"DEBUG: Inserted into corp_course_conf. ID: {corp_course_conf_id}")
        
        # 3. Iterate Modules and Lessons
        for mod_idx, mod in enumerate(modules):
            print(f"DEBUG: Processing Module: {mod.get('title')}")
            section_sql = """
                INSERT INTO corp_course_conf_section (
                    corp_course_id, corp_course_conf_id, section_name, seq_num
                ) VALUES (%s, %s, %s, %s)
            """
            cursor.execute(section_sql, (corp_course_id, corp_course_conf_id, mod.get("title"), mod_idx + 1))
            section_id = cursor.lastrowid
            
            for chap_idx, chap in enumerate(mod.get("chapters", [])):
                print(f"DEBUG:   Processing Lesson: {chap.get('title')}")
                contents = chap.get("contents", [])
                combined_html = ""
                file_path = None
                code_snippet = None
                code_result = None
                
                # Check for AI generated content or files
                if isinstance(contents, list):
                    for block in contents:
                        if block.get("content"):
                            combined_html += block["content"] + "<br/>"
                        if block.get("file_url"):
                            file_path = block["file_url"]
                        if block.get("code"):
                            code_snippet = block["code"]
                            code_result = block.get("expected_output")
                
                # Fallback for old schema
                if not combined_html and chap.get("content"):
                    combined_html = chap["content"].get("explanation", "")

                details_sql = """
                    INSERT INTO corp_course_conf_section_details (
                        corp_course_id, corp_course_conf_id, corp_course_conf_section_id,
                        page_name, seq_num, content_type, content_path, 
                        page_content, code_area, code_area_result
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                ctype = 10 # Default AI Content
                if file_path:
                    if ".mp4" in file_path.lower(): ctype = 2
                    elif ".pdf" in file_path.lower(): ctype = 3
                
                cursor.execute(details_sql, (
                    corp_course_id, corp_course_conf_id, section_id,
                    chap.get("title"), chap_idx + 1, ctype, file_path,
                    combined_html, code_snippet, code_result
                ))
        
        conn.commit()
        print(f"DEBUG: MySQL Transaction Committed successfully.")
        return corp_course_id
        
    except Exception as e:
        conn.rollback()
        print(f"DEBUG ERROR: {str(e)}")
        raise e
    finally:
        cursor.close()
        conn.close()

def get_courses_from_mysql():
    """Fetches all courses for the dashboard list with module counts."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Join with m_subject and subquery for module count
        sql = """
            SELECT c.*, s.subject_name,
            (SELECT COUNT(*) FROM corp_course_conf_section WHERE corp_course_id = c.id) as module_count
            FROM corp_course c
            LEFT JOIN m_subject s ON c.subject_id = s.subject_id
            ORDER BY c.id DESC
        """
        cursor.execute(sql)
        rows = cursor.fetchall()
        
        courses = []
        for row in rows:
            courses.append({
                "id": str(row["id"]),
                "details": {
                    "courseName": row["course_name"],
                    "description": row["course_desc"],
                    "subject": row["subject_name"],
                    "level": row["course_level"],
                    "price": str(row["course_price"]),
                    "duration": str(row["no_of_days"]),
                    "language": row["course_language"],
                    "requirements": row["requirements"],
                    "scriptingLanguage": row["script_lang"]
                },
                # Provide a fake module list with the correct length so the UI shows the count
                "structure": {"modules": [None] * row["module_count"]} 
            })
        return courses
    finally:
        cursor.close()
        conn.close()

def get_course_details_from_mysql(course_id: int):
    """Fetches the full course structure (modules + lessons) for the viewer."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 1. Fetch Course Meta
        cursor.execute("SELECT c.*, s.subject_name FROM corp_course c LEFT JOIN m_subject s ON c.subject_id = s.subject_id WHERE c.id = %s", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            return None
            
        course_obj = {
            "id": str(course_row["id"]),
            "details": {
                "courseName": course_row["course_name"],
                "description": course_row["course_desc"],
                "subject": course_row["subject_name"],
                "level": course_row["course_level"],
                "price": str(course_row["course_price"]),
                "duration": str(course_row["no_of_days"]),
                "language": course_row["course_language"],
                "requirements": course_row["requirements"],
                "scriptingLanguage": course_row["script_lang"]
            },
            "structure": {"modules": []}
        }
        
        # 2. Fetch Modules (Sections)
        cursor.execute("SELECT * FROM corp_course_conf_section WHERE corp_course_id = %s ORDER BY seq_num", (course_id,))
        module_rows = cursor.fetchall()
        
        for m_row in module_rows:
            module_obj = {
                "title": m_row["section_name"],
                "chapters": []
            }
            
            # 3. Fetch Lessons (Section Details)
            cursor.execute("SELECT * FROM corp_course_conf_section_details WHERE corp_course_conf_section_id = %s ORDER BY seq_num", (m_row["id"],))
            lesson_rows = cursor.fetchall()
            
            for l_row in lesson_rows:
                # Reconstruct contents blocks
                contents = []
                if l_row["page_content"]:
                    contents.append({"type": "ai_generated", "content": l_row["page_content"]})
                if l_row["content_path"]:
                    ctype = "video" if l_row["content_type"] == 2 else "document"
                    contents.append({"type": ctype, "file_url": l_row["content_path"]})
                if l_row["code_area"]:
                    contents.append({
                        "type": "code", 
                        "code": l_row["code_area"], 
                        "expected_output": l_row["code_area_result"]
                    })

                module_obj["chapters"].append({
                    "title": l_row["page_name"],
                    "contents": contents
                })
            
            course_obj["structure"]["modules"].append(module_obj)
            
        return course_obj
    finally:
        cursor.close()
        conn.close()
