"""Tests for budget-gated conversion kwargs plumbing."""

from __future__ import annotations

from types import SimpleNamespace

from src.cli_support.utils import _convert_kwargs


def test_default_kwargs_have_boilerplate_keys() -> None:
    kwargs = _convert_kwargs(False, False, None, None)
    assert kwargs["keep_boilerplate"] is False
    assert kwargs["full_boilerplate_strip"] is False


def test_full_strip_flag_passthrough() -> None:
    kwargs = _convert_kwargs(False, False, None, None, keep_boilerplate=True, full_boilerplate_strip=True)
    assert kwargs["keep_boilerplate"] is True
    assert kwargs["full_boilerplate_strip"] is True


def test_backend_kwargs_derive_full_strip_from_budget() -> None:
    from backend.api_routes.common import _convert_kwargs as backend_kwargs

    with_budget = backend_kwargs(SimpleNamespace(budget=4000, strip_headers_footers=False, write_images=False))
    assert with_budget["full_boilerplate_strip"] is True

    without_budget = backend_kwargs(SimpleNamespace(budget=None, strip_headers_footers=False, write_images=False))
    assert without_budget["full_boilerplate_strip"] is False


def test_backend_kwargs_keep_boilerplate_opt_out() -> None:
    from backend.api_routes.common import _convert_kwargs as backend_kwargs

    opts = SimpleNamespace(budget=4000, strip_headers_footers=False, write_images=False, keep_boilerplate=True)
    kwargs = backend_kwargs(opts)
    assert kwargs["keep_boilerplate"] is True
