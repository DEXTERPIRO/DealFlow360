from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    PORT: int = 5000
    FRONTEND_URL: str = "http://localhost:5173"
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    UPLOAD_DIR: str = "./app/uploads"

    class Config:
        env_file = ".env"

settings = Settings()
