from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IPC.ai"
    DEBUG: bool = True

    # Database — Supabase PostgreSQL (IPv4 Pooler for Render / cloud compatibility)
    DATABASE_URL: str = "postgresql+asyncpg://postgres.aaexeshzfonwpuaohsxl:Vivekmahajan@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

    @property
    def resolved_database_url(self) -> str:
        """Ensure direct Supabase URLs (IPv6-only) are automatically routed to IPv4 pooler, and strip any accidental whitespace/newlines."""
        import re
        url = (self.DATABASE_URL or "").strip().strip("'\"").strip()
        # Match //user:password@db.<ref>.supabase.co:5432/dbname
        m = re.search(r'//([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::5432)?/([^\s\?]+)', url)
        if m:
            user, pwd, project_ref, dbname = m.groups()
            dbname = dbname.strip()
            pooler_user = f"postgres.{project_ref}" if not user.startswith(f"postgres.{project_ref}") else user
            return f"postgresql+asyncpg://{pooler_user}:{pwd}@aws-0-ap-southeast-1.pooler.supabase.com:5432/{dbname}"
        return url

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
