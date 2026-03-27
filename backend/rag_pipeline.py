import os
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

CHROMA_PERSIST_DIR = "./chroma_db"

def ingest_document(file_path: str, filename: str):
    if filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif filename.endswith(".docx"):
        loader = Docx2txtLoader(file_path)
    else:
        raise ValueError("Unsupported file format")
        
    documents = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(documents)
    
    embeddings = OpenAIEmbeddings()
    # Create and persist chunks
    vectorstore = Chroma.from_documents(documents=splits, embedding=embeddings, persist_directory=CHROMA_PERSIST_DIR)
    return len(splits)

def retrieve_context(query: str, k: int = 4) -> str:
    if not os.path.exists(CHROMA_PERSIST_DIR):
        return ""
    
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings)
    docs = vectorstore.similarity_search(query, k=k)
    return "\n\n".join([doc.page_content for doc in docs])
