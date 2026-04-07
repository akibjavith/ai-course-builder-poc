import json
import os
from typing import Dict, Any

STORE_FILE = "courses.json"

def _load_store() -> Dict[str, Any]:
    if not os.path.exists(STORE_FILE):
        return {}
    with open(STORE_FILE, "r") as f:
        try:
            return json.load(f)
        except:
            return {}

def _save_store(data: Dict[str, Any]):
    with open(STORE_FILE, "w") as f:
        json.dump(data, f, indent=2)

def save_course(course_id: str, course_data: dict):
    # Server-side Validation: Ensure each chapter has at least one file
    structure = course_data.get("structure")
    if structure and "modules" in structure:
        for m in structure["modules"]:
            for c in m.get("chapters", []):
                content = c.get("content", {})
                files = content.get("files", [])
                if not files:
                    raise ValueError(f"Validation Error: Chapter '{c.get('title')}' in module '{m.get('title')}' must contain at least one file.")
                    
    store = _load_store()
    course_data["id"] = course_id
    store[course_id] = course_data
    _save_store(store)

def get_courses():
    store = _load_store()
    courses = []
    for cid, cdata in store.items():
        cdata["id"] = cid
        courses.append(cdata)
    return courses

def get_course(course_id: str):
    store = _load_store()
    cdata = store.get(course_id)
    if cdata:
        cdata["id"] = course_id
    return cdata

def update_course(course_id: str, course_data: dict):
    # Server-side Validation: Ensure each chapter has at least one file
    structure = course_data.get("structure")
    if structure and "modules" in structure:
        for m in structure["modules"]:
            for c in m.get("chapters", []):
                content = c.get("content", {})
                files = content.get("files", [])
                if not files:
                    raise ValueError(f"Validation Error: Chapter '{c.get('title')}' in module '{m.get('title')}' must contain at least one file.")

    store = _load_store()
    if course_id in store:
        course_data["id"] = course_id
        store[course_id] = course_data
        _save_store(store)

def delete_course(course_id: str):
    store = _load_store()
    if course_id in store:
        del store[course_id]
        _save_store(store)
