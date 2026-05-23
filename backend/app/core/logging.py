"""
NestJS-style structured logging for Neuro Flow.

Output format:
  [Neuro Flow]  PID  - DD/MM/YYYY, HH:MM:SS AM   LOG [Context] message
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime

from app.core.config import settings

# ── ANSI colour helpers ────────────────────────────────────────────────────────

_FORCE_COLOR = os.environ.get("FORCE_COLOR", "0") not in ("0", "false", "no")
_NO_COLOR    = os.environ.get("NO_COLOR", "") != "" and not _FORCE_COLOR
_USE_COLOR   = (sys.stdout.isatty() or _FORCE_COLOR) and not _NO_COLOR


def _c(code: str, text: str) -> str:
    return f"\x1b[{code}m{text}\x1b[0m" if _USE_COLOR else text


def _bold(t: str)       -> str: return _c("1",     t)
def _green(t: str)      -> str: return _c("32",    t)
def _bright_green(t: str) -> str: return _c("92",  t)
def _yellow(t: str)     -> str: return _c("33",    t)
def _bright_yellow(t: str) -> str: return _c("93", t)
def _red(t: str)        -> str: return _c("31",    t)
def _bright_red(t: str) -> str: return _c("91",    t)
def _cyan(t: str)       -> str: return _c("36",    t)
def _magenta(t: str)    -> str: return _c("35",    t)
def _dim(t: str)        -> str: return _c("2",     t)
def _white(t: str)      -> str: return _c("97",    t)


# ── Level formatting ──────────────────────────────────────────────────────────

_LEVEL_MAP: dict[int, tuple[str, str]] = {
    logging.DEBUG:    ("  DEBUG", "90"),
    logging.INFO:     ("    LOG", "32"),
    logging.WARNING:  ("   WARN", "33"),
    logging.ERROR:    ("  ERROR", "31"),
    logging.CRITICAL: ("  FATAL", "91"),
}


# ── Context extraction ────────────────────────────────────────────────────────

# logger names → short context labels
_CONTEXT_MAP: dict[str, str] = {
    "app.main":                    "Bootstrap",
    "app.db":                      "Database",
    "app.db.session":              "Database",
    "app.services.scheduler":      "Scheduler",
    "app.api.v1.auth":             "Auth",
    "app.api.v1.clients":          "Clients",
    "app.api.v1.assignments":      "Assignments",
    "app.api.v1.clinical_reports": "Reports",
    "app.api.v1.team":             "Team",
    "app.api.v1.forms":            "Forms",
    "app.api.v1.availability":     "Availability",
    "app.api.v1.billing":          "Billing",
    "app.services.email":          "Email",
    "uvicorn":                     "Server",
    "uvicorn.error":               "Server",
    "uvicorn.access":              "Request",
    "fastapi":                     "FastAPI",
    "sqlalchemy.engine":           "SQL",
}

_ACCESS_RE = re.compile(
    r'"(?P<method>[A-Z]+)\s+(?P<path>\S+)\s+HTTP/[^"]+"\s+(?P<status>\d+)',
)


def _context_for(name: str) -> str:
    if name in _CONTEXT_MAP:
        return _CONTEXT_MAP[name]
    for prefix, label in _CONTEXT_MAP.items():
        if name.startswith(prefix):
            return label
    parts = name.split(".")
    return parts[-1].replace("_", " ").title() if parts else name


# ── HTTP status colouring ──────────────────────────────────────────────────────

def _colour_status(status: int) -> str:
    s = str(status)
    if status < 300:   return _bright_green(s)
    if status < 400:   return _cyan(s)
    if status < 500:   return _bright_yellow(s)
    return _bright_red(s)


def _colour_method(method: str) -> str:
    colours = {
        "GET":    "32",   # green
        "POST":   "34",   # blue
        "PUT":    "33",   # yellow
        "PATCH":  "35",   # magenta
        "DELETE": "31",   # red
    }
    code = colours.get(method.upper(), "37")
    return _c(f"1;{code}", f"{method:<6}")


# ── Main formatter ─────────────────────────────────────────────────────────────

class NestFormatter(logging.Formatter):
    """Formats log records in NestJS style with ANSI colours."""

    APP  = "Neuro Flow"
    PID  = str(os.getpid())

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        # ── Timestamp ──
        now  = datetime.now()
        ts   = now.strftime("%-d/%m/%Y, %-I:%M:%S %p")   # e.g. 14/05/2026, 3:45:23 PM

        # ── Level label + colour ──
        label, colour_code = _LEVEL_MAP.get(record.levelno, ("    LOG", "37"))
        level_str = _c(f"1;{colour_code}", label)

        # ── App prefix ──
        prefix = _bright_green(f"[{self.APP}]")
        pid    = _green(self.PID)

        # ── Context ──
        ctx = _context_for(record.name)
        ctx_str = _yellow(f"[{ctx}]")

        # ── Message ──
        msg = record.getMessage()

        # Re-format uvicorn access logs
        if record.name == "uvicorn.access":
            m = _ACCESS_RE.search(msg)
            if m:
                method = m.group("method")
                path   = m.group("path")
                status = int(m.group("status"))
                msg = (
                    f"{_colour_method(method)} "
                    f"{_white(path):<55} "
                    f"{_colour_status(status)}"
                )

        # Exception info
        if record.exc_info:
            exc = self.formatException(record.exc_info)
            msg = f"{msg}\n{_dim(exc)}"

        return (
            f"{prefix}  {pid}  {_dim('-')}  {_dim(ts)}  "
            f"{level_str}  {ctx_str} {msg}"
        )


# ── Request logger (used by middleware) ────────────────────────────────────────

_req_logger = logging.getLogger("uvicorn.access")


def log_request(method: str, path: str, status: int, duration_ms: float) -> None:
    level = logging.WARNING if status >= 400 else logging.INFO
    msg   = (
        f"{_colour_method(method)} "
        f"{_white(path):<55} "
        f"{_colour_status(status)}  "
        f"{_dim(f'+{duration_ms:.0f}ms')}"
    )
    # Emit directly so the NestFormatter picks it up via the root handler
    record = logging.LogRecord(
        name="uvicorn.access",
        level=level,
        pathname="",
        lineno=0,
        msg=msg,
        args=(),
        exc_info=None,
    )
    logging.getLogger("uvicorn.access").handle(record)


# ── configure_logging ─────────────────────────────────────────────────────────

def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(NestFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Silence noisy third-party loggers
    for name in ("httpx", "httpcore", "passlib", "multipart", "jose"):
        logging.getLogger(name).setLevel(logging.WARNING)

    # uvicorn already has its own handlers — replace them
    for uv_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv = logging.getLogger(uv_name)
        uv.handlers.clear()
        uv.propagate = True

    # sqlalchemy — only show at DEBUG
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if settings.log_level.upper() == "DEBUG" else logging.WARNING
    )
