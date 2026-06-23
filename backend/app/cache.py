import threading
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

SKIP_PATHS = frozenset({"/api/health"})


class ApiCacheMiddleware(BaseHTTPMiddleware):
    """内存缓存 GET /api/* 响应，减轻 MySQL 压力。"""

    def __init__(self, app, ttl: float = 5.0):
        super().__init__(app)
        self.ttl = ttl
        self._store: dict[str, tuple[float, bytes, int, dict[str, str]]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _cache_key(request: Request) -> str:
        return f"{request.method}:{request.url.path}?{request.url.query}"

    def _get(self, key: str) -> tuple[bytes, int, dict[str, str]] | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, body, status, headers = entry
            if now >= expires_at:
                del self._store[key]
                return None
            return body, status, headers

    def _set(self, key: str, body: bytes, status: int, headers: dict[str, str]) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + self.ttl, body, status, headers)

    @staticmethod
    def _pick_headers(headers: Any) -> dict[str, str]:
        skip = {"content-length", "transfer-encoding"}
        return {k: v for k, v in headers.items() if k.lower() not in skip}

    async def dispatch(self, request: Request, call_next):
        if request.method != "GET":
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api/") or path in SKIP_PATHS:
            return await call_next(request)

        key = self._cache_key(request)
        cached = self._get(key)
        if cached is not None:
            body, status, headers = cached
            return Response(content=body, status_code=status, headers=headers)

        response = await call_next(request)
        if not 200 <= response.status_code < 300:
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        self._set(key, body, response.status_code, self._pick_headers(response.headers))
        return Response(
            content=body,
            status_code=response.status_code,
            headers=self._pick_headers(response.headers),
            media_type=response.media_type,
        )
