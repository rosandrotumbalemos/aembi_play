"""Varredura diária de arquivamento (seção 7.4 — "Cron diário").

O projeto não tem um serviço de cron separado (docker-compose.yml só lista
postgres/minio/app/worker) — em vez disso, o próprio loop do worker (ver
worker.py) chama `maybe_run_daily_sweep` a cada iteração; a função só faz
algo de fato uma vez por dia de calendário (controlado em memória — reiniciar
o worker no mesmo dia, na pior hipótese, refaz a varredura, o que é
inofensivo: a query já filtra só o que ainda é elegível).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings

logger = logging.getLogger(__name__)

_last_sweep_date: date | None = None


def _find_archivable_ad_ids(session: Session, now: datetime) -> list[str]:
    """Anúncios publicados, com backup confirmado no Drive, com mais de
    STORAGE_RETENTION_DAYS dias, ainda em 'local' e sem nenhuma campanha
    ativa agora — mesmo critério de "campanha ativa" usado em
    playlist-generator.ts (active=true, dentro do intervalo start/end).
    Um segundo filtro (por job) roda de novo dentro do handler — isto aqui
    é só pra não enfileirar um job óbvio demais."""
    settings = get_settings()
    cutoff = now - timedelta(days=settings.storage_retention_days)

    rows = session.execute(
        text(
            """
            SELECT a.id
            FROM ads a
            WHERE a.status = 'publicado'
              AND a.storage_tier = 'local'
              AND a.drive_file_id IS NOT NULL
              AND a.created_at < :cutoff
              AND NOT EXISTS (
                SELECT 1 FROM campaigns c
                WHERE c.ad_id = a.id AND c.active = true
                  AND c.start_date <= :now AND c.end_date >= :now
              )
              AND NOT EXISTS (
                SELECT 1 FROM jobs j
                WHERE j.type = 'archive_local_file'
                  AND j.status IN ('pending', 'processing')
                  AND j.payload->>'adId' = a.id::text
              )
            """
        ),
        {"cutoff": cutoff, "now": now},
    ).all()

    return [str(row[0]) for row in rows]


def run_sweep(session: Session) -> int:
    """Enfileira um job `archive_local_file` por anúncio elegível. Retorna
    quantos jobs foram criados — chamada direta (não passa por
    `maybe_run_daily_sweep`) é o que os testes usam, pra não depender de
    data/hora do sistema."""
    import json

    now = datetime.now(UTC)
    ad_ids = _find_archivable_ad_ids(session, now)

    for ad_id in ad_ids:
        session.execute(
            text(
                "INSERT INTO jobs (id, type, payload) "
                "VALUES (:id, 'archive_local_file', CAST(:payload AS jsonb))"
            ),
            {"id": uuid.uuid4(), "payload": json.dumps({"adId": ad_id})},
        )

    if ad_ids:
        logger.info("Varredura de arquivamento: %d anúncio(s) enfileirado(s)", len(ad_ids))

    return len(ad_ids)


def is_sweep_due() -> bool:
    """Checagem barata (sem tocar o banco) — worker.py só abre uma sessão
    pra rodar a varredura quando isto for True, em vez de abrir uma sessão
    nova a cada iteração do loop só pra descobrir que ainda não é hoje."""
    return _last_sweep_date != datetime.now(UTC).date()


def maybe_run_daily_sweep(session: Session) -> None:
    """Roda `run_sweep` no máximo uma vez por dia de calendário (UTC).
    Chame só depois de `is_sweep_due()` retornar True (ver worker.py)."""
    global _last_sweep_date

    today = datetime.now(UTC).date()
    if _last_sweep_date == today:
        return

    _last_sweep_date = today
    run_sweep(session)
