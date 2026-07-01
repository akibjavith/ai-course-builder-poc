import mysql.connector
import os
import json
from dotenv import load_dotenv
from typing import Dict, Any

load_dotenv()

def get_db_connection():
    # Convert port to integer, defaulting to 3306 if not found
    db_port = int(os.getenv("DB_PORT", 3306)) 
    
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=db_port, # <--- Now it's a number!
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
        # Fetch available columns for compatibility across DB variants
        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'corp_course_conf_section_details'
            """
        )
        # Case-insensitive lookup to avoid missing columns due to casing differences.
        details_cols_raw = [row[0] for row in cursor.fetchall()]
        details_cols_map = {str(name).lower(): name for name in details_cols_raw}
        track_col = details_cols_map.get("track_excercise")
        # DBs may use camelCase or snake_case for this flag.
        docwise_col = details_cols_map.get("docwisetimetrackflag") or details_cols_map.get("doc_wise_time_track_flag")
        has_track_excercise = track_col is not None
        has_docwise_flag = docwise_col is not None

        details = course_data.get("details", {})
        structure = course_data.get("structure", {})
        modules = structure.get("modules", [])
        
        # Determine if we should update or insert
        mysql_id = course_data.get("mysql_id")
        
        # 1. Dynamic Subject ID Lookup
        subject_name = details.get("subject", "General")
        cursor.execute("SELECT subject_id FROM m_subject WHERE subject_name = %s", (subject_name,))
        result = cursor.fetchone()
        subject_id = result[0] if result else 1
        
        # Determine elearn_flag
        has_content = 1 if any(mod.get("chapters") for mod in modules) else 0
        
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if mysql_id:
            # UPDATE EXISTING COURSE
            print(f"DEBUG: Updating course {mysql_id}")
            course_sql = """
                UPDATE corp_course SET 
                    course_name = %s, course_desc = %s, subject_id = %s, course_price = %s, 
                    script_lang = %s, no_of_days = %s, requirements = %s, course_level = %s, 
                    course_language = %s, elearn_flag = %s, last_updated_on = %s
                WHERE id = %s
            """
            course_vals = (
                details.get("courseName"), details.get("description"), subject_id,
                details.get("price"), details.get("scriptingLanguage"), details.get("duration") or 30,
                details.get("requirements"), details.get("level"), details.get("language", "English"),
                has_content, now_str, mysql_id
            )
            cursor.execute(course_sql, course_vals)
            corp_course_id = mysql_id
            
            # Flush old structure to rebuild (using safe cascading order and disabling foreign key checks during rebuilding)
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            cursor.execute("""
                DELETE FROM corp_course_conf_section_details 
                WHERE corp_course_id = %s OR corp_course_conf_section_id IN (
                    SELECT id FROM corp_course_conf_section WHERE corp_course_id = %s
                )
            """, (mysql_id, mysql_id))
            cursor.execute("DELETE FROM corp_course_conf_section WHERE corp_course_id = %s", (mysql_id,))
            cursor.execute("DELETE FROM corp_course_conf WHERE corp_course_id = %s", (mysql_id,))
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        else:
            # INSERT NEW COURSE
            course_sql = """
                INSERT INTO corp_course (
                    course_name, course_desc, subject_id, course_price, script_lang, 
                    no_of_days, requirements, course_level, course_language, 
                    active_status, elearn_flag, exam_flag, created_by, tenant_id, last_updated_on
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            course_vals = (
                details.get("courseName"), details.get("description"), subject_id,
                details.get("price"), details.get("scriptingLanguage"), details.get("duration") or 30,
                details.get("requirements"), details.get("level"), details.get("language", "English"),
                0, has_content, 1, 2354, 1, now_str
            )
            cursor.execute(course_sql, course_vals)
            corp_course_id = cursor.lastrowid
        
        # 2. Insert into corp_course_conf
        conf_sql = "INSERT INTO corp_course_conf (course_conf_name, corp_course_id, track_flag, control_flow_flag, restrict_flow_flag) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(conf_sql, (f"{details.get('courseName')} Config", corp_course_id, 1, 1, 1))
        corp_course_conf_id = cursor.lastrowid
        
        # 3. Iterate Modules and Lessons
        for mod_idx, mod in enumerate(modules):
            section_sql = "INSERT INTO corp_course_conf_section (corp_course_id, corp_course_conf_id, section_name, seq_num) VALUES (%s, %s, %s, %s)"
            cursor.execute(section_sql, (corp_course_id, corp_course_conf_id, mod.get("title"), mod_idx + 1))
            section_id = cursor.lastrowid
            
            for chap_idx, chap in enumerate(mod.get("chapters", [])):
                contents = chap.get("contents", [])
                block_based_item = next((b for b in contents if b.get("type") == "lesson-blocks"), None) if isinstance(contents, list) else None
                if block_based_item:
                    combined_html = json.dumps(block_based_item)
                else:
                    combined_html = "".join([b.get("content", "") + "<br/>" for b in contents]) if isinstance(contents, list) else ""
                file_path = next((b.get("file_url") for b in contents if b.get("file_url")), "") if isinstance(contents, list) else ""
                code_snippet = next((b.get("code") for b in contents if b.get("code")), "") if isinstance(contents, list) else ""
                code_result = next((b.get("expected_output") for b in contents if b.get("expected_output")), "") if isinstance(contents, list) else ""
                
                # Build INSERT based on actual table columns (avoids breaking when columns differ)
                col_names = [
                    "corp_course_id", "corp_course_conf_id", "corp_course_conf_section_id",
                    "page_name", "seq_num", "content_type", "content_path",
                    "page_content", "code_area", "code_area_result", "days",
                    "time_to_spend", "time_to_spend_per_page",
                    "page_num", "file_name", "elearn_fcard_ids", "reference_links",
                ]
                placeholders = ["%s"] * 11 + ["0", "0", "''", "''", "''", "''"]

                if has_track_excercise:
                    col_names.append(track_col)
                    placeholders.append("1")
                if has_docwise_flag:
                    col_names.append(docwise_col)
                    placeholders.append("1")

                details_sql = f"""
                    INSERT INTO corp_course_conf_section_details (
                        {", ".join(col_names)}
                    ) VALUES ({", ".join(placeholders)})
                """
                
                ctype = 0 
                if file_path:
                    if ".mp4" in file_path.lower(): ctype = 2
                    elif ".pdf" in file_path.lower(): ctype = 3
                
                cursor.execute(details_sql, (
                    corp_course_id, corp_course_conf_id, section_id,
                    chap.get("title"), chap_idx + 1, ctype, file_path,
                    combined_html, code_snippet, code_result, 1
                ))

        # Ensure flags are set to 1 for all inserted lesson rows.
        # Some environments have schema/name variations (camelCase vs snake_case) or defaults/triggers.
        def try_update_flag(possible_cols, value_sql):
            for col in possible_cols:
                if not col:
                    continue
                try:
                    cursor.execute(
                        f"UPDATE corp_course_conf_section_details SET {col} = {value_sql} WHERE corp_course_id = %s",
                        (corp_course_id,)
                    )
                except Exception:
                    # Ignore unknown-column errors and try the next variant
                    continue

        if has_track_excercise:
            try_update_flag(
                [
                    track_col,
                    details_cols_map.get("track_excercise"),
                    details_cols_map.get("track_exercise"),
                    details_cols_map.get("trackexcercise"),
                    details_cols_map.get("trackexercise"),
                ],
                "1",
            )

        # For docWiseTimeTrackFlag, try multiple known naming variants (including the exact snake_case you reported).
        try_update_flag(
            [
                docwise_col,
                details_cols_map.get("docwisetimetrackflag"),
                details_cols_map.get("docwise_time_track_flag"),
                details_cols_map.get("doc_wise_time_track_flag"),
                details_cols_map.get("doc_wise_time_track_flg"),
                # If INFORMATION_SCHEMA isn't accessible, still try the literal column name.
                "doc_Wise_Time_Track_Flag",
                details_cols_map.get("docwisetimetrackflg"),
                details_cols_map.get("docwisetimetrack"),
            ],
            "1",
        )
        
        conn.commit()
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
                "mysql_id": row["id"],
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
            "mysql_id": course_id,
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
                    page_content_str = l_row["page_content"].strip()
                    if (page_content_str.startswith("{") and page_content_str.endswith("}")) or (page_content_str.startswith("[") and page_content_str.endswith("]")):
                        try:
                            block_data = json.loads(page_content_str)
                            contents.append(block_data)
                        except Exception:
                            contents.append({
                                "type": "html", 
                                "content": l_row["page_content"],
                                "source": "ai",
                                "completed": True,
                                "timestamp": l_row.get("created_at")
                            })
                    else:
                        contents.append({
                            "type": "html", 
                            "content": l_row["page_content"],
                            "source": "ai",
                            "completed": True,
                            "timestamp": l_row.get("created_at")
                        })
                
                if l_row["content_path"]:
                    ctype = "video" if l_row["content_type"] == 2 else "document"
                    contents.append({
                        "type": ctype, 
                        "file_url": l_row["content_path"],
                        "source": "manual",
                        "completed": True,
                        "file_name": l_row["content_path"].split('/')[-1]
                    })
                
                if l_row["code_area"]:
                    contents.append({
                        "type": "code", 
                        "content": l_row["code_area"],
                        "code": l_row["code_area"], 
                        "expected_output": l_row["code_area_result"],
                        "source": "ai",
                        "completed": True
                    })

                module_obj["chapters"].append({
                    "title": l_row["page_name"],
                    "contents": contents,
                    # Fallback for older code that might look at 'content' directly
                    "content": contents[0] if contents else {"completed": False}
                })
            
            course_obj["structure"]["modules"].append(module_obj)
            
        return course_obj
    finally:
        cursor.close()
        conn.close()

def get_all_subjects_from_mysql():
    """Fetches all subject names and IDs from m_subject table."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT subject_id, subject_name FROM m_subject ORDER BY subject_name")
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def get_local_db_connection():
    db_port = int(os.getenv("LOCAL_DB_PORT", 3306))
    return mysql.connector.connect(
        host=os.getenv("LOCAL_DB_HOST", "localhost"),
        user=os.getenv("LOCAL_DB_USER", "root"),
        password=os.getenv("LOCAL_DB_PASSWORD", ""),
        database=os.getenv("LOCAL_DB_NAME", "ai_course_db"),
        port=db_port,
        charset='utf8mb4',
        collation='utf8mb4_unicode_ci'
    )

def init_draft_table():
    # Make sure target database exists by connecting without DB name first
    db_port = int(os.getenv("LOCAL_DB_PORT", 3306))
    db_name = os.getenv("LOCAL_DB_NAME", "ai_course_db")
    
    # Try connecting without specifying DB name first to create the schema if missing
    temp_conn = mysql.connector.connect(
        host=os.getenv("LOCAL_DB_HOST", "localhost"),
        user=os.getenv("LOCAL_DB_USER", "root"),
        password=os.getenv("LOCAL_DB_PASSWORD", ""),
        port=db_port
    )
    temp_cursor = temp_conn.cursor()
    try:
        temp_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        temp_conn.commit()
    except Exception as e:
        print(f"Error creating local database {db_name}: {e}")
    finally:
        temp_cursor.close()
        temp_conn.close()

    # Now connect to the database and build the table
    conn = get_local_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS corp_chatbot_course_draft (
                id VARCHAR(50) PRIMARY KEY,
                course_name VARCHAR(255),
                current_step VARCHAR(50),
                course_data LONGTEXT,
                messages LONGTEXT,
                created_at DATETIME,
                updated_at DATETIME
            )
        """)
        conn.commit()
        print("DEBUG: Local MySQL drafts table initialized successfully.")
    except Exception as e:
        print(f"Error initializing local draft table: {e}")
    finally:
        cursor.close()
        conn.close()

def save_chatbot_draft(draft_id: str, course_name: str, current_step: str, course_data: dict, messages: list):
    conn = get_local_db_connection()
    cursor = conn.cursor()
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    course_data_json = json.dumps(course_data)
    messages_json = json.dumps(messages)
    
    try:
        # Check if exists
        cursor.execute("SELECT id FROM corp_chatbot_course_draft WHERE id = %s", (draft_id,))
        exists = cursor.fetchone()
        
        if exists:
            sql = """
                UPDATE corp_chatbot_course_draft SET
                    course_name = %s,
                    current_step = %s,
                    course_data = %s,
                    messages = %s,
                    updated_at = %s
                WHERE id = %s
            """
            cursor.execute(sql, (course_name, current_step, course_data_json, messages_json, now_str, draft_id))
        else:
            sql = """
                INSERT INTO corp_chatbot_course_draft 
                    (id, course_name, current_step, course_data, messages, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (draft_id, course_name, current_step, course_data_json, messages_json, now_str, now_str))
            
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def get_chatbot_drafts():
    conn = get_local_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, course_name, current_step, course_data, messages, updated_at FROM corp_chatbot_course_draft ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        drafts = []
        for r in rows:
            try:
                cdata = json.loads(r["course_data"]) if r["course_data"] else {}
            except Exception:
                cdata = {}
            try:
                msgs = json.loads(r["messages"]) if r["messages"] else []
            except Exception:
                msgs = []
                
            drafts.append({
                "id": r["id"],
                "courseName": r["course_name"],
                "currentStep": r["current_step"],
                "courseData": cdata,
                "messages": msgs,
                "updated_at": r["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if hasattr(r["updated_at"], "strftime") else str(r["updated_at"])
            })
        return drafts
    finally:
        cursor.close()
        conn.close()

def get_chatbot_draft(draft_id: str):
    conn = get_local_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, course_name, current_step, course_data, messages FROM corp_chatbot_course_draft WHERE id = %s", (draft_id,))
        r = cursor.fetchone()
        if not r:
            return None
        try:
            cdata = json.loads(r["course_data"]) if r["course_data"] else {}
        except Exception:
            cdata = {}
        try:
            msgs = json.loads(r["messages"]) if r["messages"] else []
        except Exception:
            msgs = []
            
        return {
            "id": r["id"],
            "courseName": r["course_name"],
            "currentStep": r["current_step"],
            "courseData": cdata,
            "messages": msgs
        }
    finally:
        cursor.close()
        conn.close()

def delete_chatbot_draft(draft_id: str):
    conn = get_local_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM corp_chatbot_course_draft WHERE id = %s", (draft_id,))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def rename_chatbot_draft(draft_id: str, new_name: str):
    conn = get_local_db_connection()
    cursor = conn.cursor()
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        cursor.execute("UPDATE corp_chatbot_course_draft SET course_name = %s, updated_at = %s WHERE id = %s", (new_name, now_str, draft_id))
        conn.commit()
    finally:
        cursor.close()
        conn.close()


