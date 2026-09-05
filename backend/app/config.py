from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres123@localhost:5432/dealflow360"
    JWT_SECRET: str = "dealflow360_jwt_secret_2024_xyz"
    JWT_REFRESH_SECRET: str = "dealflow360_refresh_secret_2024_abc"
    PORT: int = 5000
    FRONTEND_URL: str = "http://localhost:5173"
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    UPLOAD_DIR: str = "./app/uploads"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
