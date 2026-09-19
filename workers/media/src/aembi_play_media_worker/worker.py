"""Loop principal do worker — consome a fila `jobs` (seção 3.1)."""

from __future__ import annotations

import logging
import time

from .config import get_settings
from .db import get_session
from .handlers import HANDLERS
from .queue import claim_next_job, mark_completed, mark_failed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def process_once() -> bool:
    """Reivindica e processa um único job. Retorna True se algo foi processado."""
    with get_session() as session:
        job = claim_next_job(session)
        if job is None:
            return False

        handler = HANDLERS.get(job.type)
        if handler is None:
            mark_failed(session, job.id, f"Tipo de job desconhecido: {job.type}")
            return True

        try:
            handler(session, job.payload)
            mark_completed(session, job.id)
            logger.info("Job %s (%s) concluído", job.id, job.type)
        except Exception as exc:  # noqa: BLE001 — job isolado não deve derrubar o worker
            logger.exception("Job %s (%s) falhou", job.id, job.type)
            mark_failed(session, job.id, str(exc))

        return True


def main() -> None:
    settings = get_settings()
    logger.info("Aembi Play — worker de mídia iniciado")
    logger.info("Aguardando jobs a cada %.1fs...", settings.worker_poll_interval_seconds)

    while True:
        try:
            processed = process_once()
        except Exception:
            logger.exception("Erro inesperado no loop principal")
            processed = False

        if not processed:
            time.sleep(settings.worker_poll_interval_seconds)


if __name__ == "__main__":
    main()
