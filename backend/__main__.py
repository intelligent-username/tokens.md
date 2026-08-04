"""Main entry point for running backend via `python -m backend`."""

from __future__ import annotations

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.app:create_app", factory=True, host="127.0.0.1", port=8642, reload=True)
