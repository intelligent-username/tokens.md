"""
Simplest entry point to the project
    run the CLI via ``python src/main.py``.

``tmd`` (the installed console script) and this module are two different ways
to invoke the same CLI. Running the script directly needs no editable install —
just the dependencies available in the environment. The core logic is
modality-agnostic, so future entry points (e.g. a GUI or web frontend) can
reuse the same modules.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.cli import main  # noqa: E402

if __name__ == "__main__":
    main()
