import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

IN_DOCKER = Path("/.dockerenv").exists()


def _env(key: str, default: str = "") -> str:
    value = os.getenv(key, default)
    if value and "#" in value:
        value = value.split("#", 1)[0].strip()
    return value


def _default_mysql_host() -> str:
    return "host.docker.internal" if IN_DOCKER else "localhost"


def _resolve_mysql_host() -> str:
    host = _env("MYSQL_HOST", _default_mysql_host())
    if IN_DOCKER and host in ("localhost", "127.0.0.1"):
        return "host.docker.internal"
    return host


class Settings:
    MYSQL_HOST: str = _resolve_mysql_host()
    MYSQL_PORT: int = int(_env("MYSQL_PORT", "3306"))
    MYSQL_USER: str = _env("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = _env("MYSQL_PASSWORD", "")
    MYSQL_DB: str = _env("MYSQL_DB", "xtrader")
    MYSQL_CHARSET: str = _env("MYSQL_CHARSET", "utf8mb4")
    API_CACHE_TTL_SECONDS: float = float(_env("API_CACHE_TTL_SECONDS", "5"))


settings = Settings()
