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
    print("DEBUG: Starting save_course_to_mysql...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        details = course_data.get("details", {})
        structure = course_data.get("structure", {})
        modules = structure.get("modules", [])
        
        print(f"DEBUG: Mapping course: {details.get('courseName')}")
        
        # 1. Insert into corp_course
        subject_id = SUBJECT_MAP.get(details.get("subject"), 1) # Default to 1 (English) if not found
        
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
