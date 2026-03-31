"""
HyperMart — Database Configuration
SQLite + SQLAlchemy with session factory and convenience helpers.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from models import Base

# ── Config ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hypermart.db")


def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


# ── Engine ────────────────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
)

if DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _set_sqlite_pragma)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def drop_tables() -> None:
    Base.metadata.drop_all(bind=engine)


@contextmanager
def get_db_ctx() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
