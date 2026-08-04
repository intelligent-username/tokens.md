"""FastAPI application factory for the tokens.md web UI."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from src import __version__
from src.deps import MissingDependencyError
from src.registry import UnsupportedFormatError

from . import routes
from .config import Settings
from .schemas import ErrorBody
from .workspace import NotFoundError, cleanup_all, start_janitor
from .ws import WsManager

logger = logging.getLogger("backend")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app with CORS, router, static mount, and lifespan."""
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ws_manager.bind_loop(asyncio.get_running_loop())
        janitor_stop = start_janitor(settings.session_ttl_hours)
        app.state.janitor_stop = janitor_stop
        try:
            yield
        finally:
            app.state.ws_manager.shutdown()
            janitor_stop.set()
            cleanup_all()

    app = FastAPI(title="tokens.md API", version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.ws_manager = WsManager()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(routes.router, prefix="/api")

    @app.exception_handler(routes.ApiError)
    async def api_error_handler(request: Request, exc: routes.ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorBody(code=exc.code, message=exc.message).model_dump(),
        )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content=ErrorBody(code="not_found", message=str(exc)).model_dump(),
        )

    @app.exception_handler(MissingDependencyError)
    async def missing_dependency_handler(
        request: Request, exc: MissingDependencyError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content=ErrorBody(code="missing_dependency", message=str(exc)).model_dump(),
        )

    @app.exception_handler(UnsupportedFormatError)
    async def unsupported_format_handler(
        request: Request, exc: UnsupportedFormatError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=ErrorBody(code="unsupported_format", message=str(exc)).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.error(f"Unhandled server error: {exc}", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=ErrorBody(code="internal_error", message=str(exc)).model_dump(),
        )

    if settings.ui_dir and settings.ui_dir.is_dir():
        app.mount(
            "/", StaticFiles(directory=str(settings.ui_dir), html=True), name="ui"
        )
    else:

        @app.get("/", response_class=HTMLResponse)
        async def not_built() -> HTMLResponse:
            return HTMLResponse(
                "<html><body><h1>Frontend not built</h1>"
                "<p>Run <code>cd frontend && npm run build</code> and restart "
                "<code>tmd ui</code>.</p></body></html>"
            )

    return app