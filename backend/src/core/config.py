from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IPC.ai"
    DEBUG: bool = True

    # Database — Supabase PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:Vivekmahajan@db.aaexeshzfonwpuaohsxl.supabase.co:5432/postgres"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Primary LLM: Gemini (3.7 Flash, 3.6 Flash, 3.5 Flash)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Fallback LLM: Groq (groq/compound)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "groq/compound"

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "ipcai-pdfs"
    R2_ENDPOINT_URL: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
