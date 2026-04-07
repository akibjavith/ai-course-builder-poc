from app.config import settings
from chromadb import PersistentClient

def get_chroma_client():
    client = PersistentClient(path=settings.CHROMA_DB_DIR)
    return client

def get_chroma_collection():
    client = get_chroma_client()
    return client.get_or_create_collection("course_chunks")
