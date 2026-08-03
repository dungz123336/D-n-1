"""Application logger."""

import logging
import sys
from pathlib import Path

from backend.config import get_settings


def setup_logging() -> logging.Logger:
    settings = get_settings()
    Path(settings.log_dir).mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("booknest_concierge")
    logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    fh = logging.FileHandler(Path(settings.log_dir) / "app.log", encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    return logger


logger = setup_logging()
