from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.production import is_sqlite_url

_db_url = settings.database_url
_engine_kwargs: dict = {"pool_pre_ping": True}

if is_sqlite_url(_db_url):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / other servers — do not pass SQLite-only connect_args
    _engine_kwargs.update(
        {
            "pool_size": 5,
            "max_overflow": 10,
        }
    )

engine = create_engine(_db_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
