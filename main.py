"""Vercel / ASGI entrypoint — re-export FastAPI app from backend package."""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app

__all__ = ["app"]
