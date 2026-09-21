"""Engine/sessão SQLAlchemy.

Importante: este worker NÃO possui migrations próprias. O schema é de
propriedade do Drizzle (packages/database) — ver PROJECT_BRIEF.md seção 3.1.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings


def _sqlalchemy_url(database_url: str) -> str:
    """Força o driver psycopg (v3, dependência do projeto) — sem isso o
    SQLAlchemy usa "postgresql://" como atalho pra psycopg2, que não é uma
    dependência daqui (o .env.example do monorepo não especifica driver
    porque quem mais lê DATABASE_URL é o `postgres` do Node, que não liga
    pra isso)."""
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


engine = create_engine(
    _sqlalchemy_url(get_settings().database_url), pool_pre_ping=True, future=True
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


@contextmanager
def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
