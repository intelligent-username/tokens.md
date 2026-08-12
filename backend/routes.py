"""REST + WebSocket router aggregation for the tokens.md web API."""

from __future__ import annotations

from fastapi import APIRouter

from .api_routes.common import ApiError
from .api_routes.convert_routes import router as convert_router
from .api_routes.files_routes import router as files_router
from .api_routes.watch_routes import router as watch_router

router = APIRouter()

router.include_router(files_router)
router.include_router(convert_router)
router.include_router(watch_router)

__all__ = ["ApiError", "router"]