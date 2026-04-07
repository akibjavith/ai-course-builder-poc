from langchain.text_splitter import RecursiveCharacterTextSplitter

def split_text_into_chunks(text: str, chunk_size: int = 800, chunk_overlap: int = 200) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_text(text)
    return chunks
