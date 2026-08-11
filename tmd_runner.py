"""Root-level entry point for Nuitka compilation.

Nuitka compiles a file as __main__, which strips package context from any
script inside a package directory (making relative imports fail). This shim
lives outside the src/ package so it has no parent package, and imports
src.cli by absolute name — which works correctly both when run directly and
when compiled by Nuitka with --include-package=src.
"""

from src.cli import main

if __name__ == "__main__":
    main()
