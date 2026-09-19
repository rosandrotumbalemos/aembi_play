"""Fila de jobs compartilhada — tabela `jobs` no PostgreSQL.

Consumida com `SELECT ... FOR UPDATE SKIP LOCKED`, para permitir múltiplos
workers concorrentes sem duplicar processamento (PROJECT_BRIEF.md seção 3.1).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass
class Job:
    id: uuid.UUID
    type: str
    payload: dict[str, Any]
    status: str
    attempts: int


def claim_next_job(session: Session) -> Job | None:
    """Reivindica o próximo job pendente de forma atômica."""
    row = session.execute(
        text(
            """
            SELECT id, type, payload, status, attempts
            FROM jobs
            WHERE status = 'pending'
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        )
    ).mappings().first()

    if row is None:
        return None

    session.execute(
        text(
            """
            UPDATE jobs
            SET status = 'processing', updated_at = :now, attempts = attempts + 1
            WHERE id = :id
            """
        ),
        {"id": row["id"], "now": datetime.now(UTC)},
    )

    return Job(
        id=row["id"],
        type=row["type"],
        payload=row["payload"],
        status="processing",
        attempts=row["attempts"] + 1,
    )


def mark_completed(session: Session, job_id: uuid.UUID) -> None:
    session.execute(
        text("UPDATE jobs SET status = 'completed', updated_at = :now WHERE id = :id"),
        {"id": job_id, "now": datetime.now(UTC)},
    )


def mark_failed(session: Session, job_id: uuid.UUID, error: str) -> None:
    session.execute(
        text(
            """
            UPDATE jobs
            SET status = 'failed', updated_at = :now, last_error = :error
            WHERE id = :id
            """
        ),
        {"id": job_id, "now": datetime.now(UTC), "error": error[:2000]},
    )
