import os
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
import json

CHROMA_PERSIST_DIR = "./chroma_db"

def ingest_document(file_path: str, filename: str):
    if filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif filename.endswith(".docx"):
        loader = Docx2txtLoader(file_path)
    else:
        loader = TextLoader(file_path, encoding='utf-8')
        
    documents = loader.load()
    
    # Recursive character text splitter with chunk_size 800 and overlap 200
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=200)
    splits = text_splitter.split_documents(documents)
    
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    # Create and persist chunks
    vectorstore = Chroma.from_documents(documents=splits, embedding=embeddings, persist_directory=CHROMA_PERSIST_DIR)
    return len(splits)

def retrieve_context(query: str, k: int = 15) -> str:
    if not os.path.exists(CHROMA_PERSIST_DIR):
        return ""
    
    # 1. Semantic Retrieval
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings)
    initial_docs = vectorstore.similarity_search(query, k=k)
    
    if not initial_docs:
        return ""

    # 2. LLM Reranker
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    rerank_prompt = PromptTemplate(
        input_variables=["query", "documents"],
        template="""You are a ranking algorithm. Evaluate the relevance of the following documents to the query.
Query: {query}
Documents:
{documents}

Rank the top 5 most relevant document indices. Formulate the response as a JSON array of integers like [0, 2, 3]. Do NOT return any other text.
"""
    )
    
    docs_text = "\n\n".join([f"[{i}] {doc.page_content}" for i, doc in enumerate(initial_docs)])
    chain = rerank_prompt | llm
    
    try:
        response = chain.invoke({"query": query, "documents": docs_text})
        content = response.content.strip().replace("```json", "").replace("```", "")
        top_indices = json.loads(content)
        final_docs = [initial_docs[i] for i in top_indices if i < len(initial_docs)]
    except Exception as e:
        # Fallback if reranking fails
        final_docs = initial_docs[:8]
    
    # Output to single string for internal document usage
    context_string = "\n\n".join([doc.page_content.strip() for doc in final_docs])
    return context_string
