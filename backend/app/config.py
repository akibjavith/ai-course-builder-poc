from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Course Builder Web Backend"
    API_V1_STR: str = "/api/v1"
    
    OPENAI_API_KEY: str = ""
    CHROMA_DB_DIR: str = "./chroma_db"
    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = ".env"

settings = Settings()
