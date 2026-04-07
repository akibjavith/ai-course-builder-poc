from openai import AsyncOpenAI
import uuid
from app.config import settings
from app.dependencies import get_chroma_collection

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def generate_embedding(text: str) -> list[float]:
    response = await client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

async def store_chunks_in_chroma(course_id: str, chunks: list[str]):
    collection = get_chroma_collection()
    
    ids = []
    embeddings = []
    documents = []
    metadatas = []
    
    for i, chunk in enumerate(chunks):
        chunk_id = f"{course_id}-chunk-{i}"
        emb = await generate_embedding(chunk)
        
        ids.append(chunk_id)
        embeddings.append(emb)
        documents.append(chunk)
        metadatas.append({"course_id": course_id, "chunk_index": i})
        
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

async def search_chunks(course_id: str, query: str, top_k: int = 20) -> list[str]:
    collection = get_chroma_collection()
    query_emb = await generate_embedding(query)
    
    results = collection.query(
        query_embeddings=[query_emb],
        n_results=top_k,
        where={"course_id": course_id}
    )
    
    if results['documents'] and results['documents'][0]:
        return results['documents'][0]
    return []
