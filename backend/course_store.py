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
    store = _load_store()
    store[course_id] = course_data
    _save_store(store)

def get_courses():
    store = _load_store()
    return list(store.values())

def get_course(course_id: str):
    store = _load_store()
    return store.get(course_id)
