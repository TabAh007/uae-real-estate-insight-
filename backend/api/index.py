"""Vercel serverless entry point — exposes the FastAPI ASGI app.

Vercel's Python runtime serves a module-level `app` as an ASGI application.
All routes are rewritten to this file by vercel.json, so FastAPI's own router
handles the paths.
"""
import os
import sys

# Make the `app` package importable from the function's working directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402  (import after sys.path tweak)

__all__ = ["app"]
