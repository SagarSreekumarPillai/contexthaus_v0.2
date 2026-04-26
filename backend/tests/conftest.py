"""Pytest hooks: isolate DB before any test imports `app` (engine is created at import time)."""

import os
import tempfile
from pathlib import Path

_fd, _TEST_SQLITE = tempfile.mkstemp(suffix="_pytest.sqlite")
os.close(_fd)
try:
    os.unlink(_TEST_SQLITE)
except OSError:
    pass

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{Path(_TEST_SQLITE).resolve().as_posix()}"
# Do not inherit seed flags from developer .env — tests control their own flow.
os.environ.pop("SEED_DEFAULT_ACCOUNT", None)
for k in ("SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_ORG_NAME", "SEED_ADMIN_FULL_NAME"):
    os.environ.pop(k, None)
