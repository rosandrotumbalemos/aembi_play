"""Um handler por tipo de job (ver packages/shared JobTypeSchema)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

JobHandler = Any  # Callable[[Session, dict], None] — evita import circular


def handle_validate_video(session: Session, payload: dict) -> None:
    """Valida MIME/tamanho/formato do vídeo recém-enviado (seção 2.4)."""
    from pathlib import Path

    from .media import sha256_of_file, validate_upload

    local_path = Path(payload["local_path"])
    is_valid, error = validate_upload(local_path)

    if not is_valid:
        raise ValueError(error)

    checksum = sha256_of_file(local_path)
    logger.info("Vídeo validado: %s (sha256=%s)", local_path.name, checksum)
    # TODO: persistir sha256/status na tabela `ads` via SQLAlchemy Core.


def handle_backup_to_drive(session: Session, payload: dict) -> None:
    """Backup no Google Drive, disparado imediatamente após o upload (seção 7.3)."""
    from pathlib import Path

    from .drive import backup_file

    local_path = Path(payload["local_path"])
    drive_file_id = backup_file(local_path, file_name=local_path.name)
    logger.info("Backup no Drive concluído: %s -> %s", local_path.name, drive_file_id)
    # TODO: persistir drive_file_id em `ads.drive_file_id`.


def handle_restore_from_drive(session: Session, payload: dict) -> None:
    """Restaura um vídeo arquivado antes de republicar o manifesto (seção 7.5)."""
    from pathlib import Path

    from .drive import restore_file

    destination = Path(payload["destination_path"])
    restore_file(payload["drive_file_id"], destination)
    logger.info("Restaurado do Drive: %s", destination.name)


def handle_archive_local_file(session: Session, payload: dict) -> None:
    """Cron diário: remove do local os arquivos >7 dias sem campanha ativa (seção 7.4)."""
    logger.info("Arquivamento local — ad_id=%s", payload.get("ad_id"))
    # TODO: checar campanhas ativas, remover do MinIO mantendo drive_file_id.


def handle_expire_campaign(session: Session, payload: dict) -> None:
    """Expira campanhas vencidas e ajusta as playlists afetadas."""
    logger.info("Expirando campanha — campaign_id=%s", payload.get("campaign_id"))
    # TODO: marcar campanha como expirada e regenerar playlists das telas afetadas.


HANDLERS: dict[str, JobHandler] = {
    "validate_video": handle_validate_video,
    "backup_to_drive": handle_backup_to_drive,
    "restore_from_drive": handle_restore_from_drive,
    "archive_local_file": handle_archive_local_file,
    "expire_campaign": handle_expire_campaign,
}
