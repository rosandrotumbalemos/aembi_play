"""Um handler por tipo de job (ver packages/shared JobTypeSchema)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

JobHandler = Any  # Callable[[Session, dict], None] — evita import circular


def handle_validate_video(session: Session, payload: dict) -> None:
    """Baixa o vídeo recém-enviado do MinIO, valida (MIME/tamanho/ffprobe) e
    publica o anúncio (seção 2.4/7). apps/web já salvou o arquivo e criou a
    linha em `ads` com status "rascunho" antes de enfileirar este job —
    payload: {"adId": "...", "storageKey": "ads/<uuid>.mp4"}.
    """
    import tempfile
    from pathlib import Path

    from .media import generate_thumbnail, probe_video, sha256_of_file, validate_upload
    from .storage import download_ad_video, upload_ad_thumbnail

    ad_id = payload["adId"]
    storage_key = payload["storageKey"]

    with tempfile.TemporaryDirectory() as tmp_dir:
        local_path = Path(tmp_dir) / "video.mp4"
        download_ad_video(storage_key, local_path)

        is_valid, error = validate_upload(local_path)
        if not is_valid:
            # Anúncio fica em "rascunho" — o job "failed" (com last_error) é
            # o que o painel usa pra mostrar "Falha na validação".
            raise ValueError(error)

        probe = probe_video(local_path)
        checksum = sha256_of_file(local_path)

        # Miniatura (seção 9.2) — melhor esforço: se o ffmpeg falhar em
        # extrair o frame por algum motivo, o anúncio ainda é publicado
        # normalmente, só sem miniatura (o painel cai pro ícone genérico).
        thumbnail_key: str | None = None
        try:
            thumbnail_path = Path(tmp_dir) / "thumb.jpg"
            generate_thumbnail(local_path, thumbnail_path, probe.duration_seconds)
            thumbnail_key = f"ads/thumbnails/{ad_id}.jpg"
            upload_ad_thumbnail(thumbnail_path, thumbnail_key)
        except Exception:
            logger.exception("Falha ao gerar miniatura — ad_id=%s (seguindo sem ela)", ad_id)
            thumbnail_key = None

        session.execute(
            text(
                """
                UPDATE ads
                SET duration_seconds = :duration_seconds,
                    video_codec = :video_codec,
                    audio_codec = :audio_codec,
                    sha256 = :sha256,
                    thumbnail_key = :thumbnail_key,
                    status = 'publicado',
                    updated_at = :now
                WHERE id = :ad_id
                """
            ),
            {
                "duration_seconds": round(probe.duration_seconds),
                "video_codec": probe.video_codec,
                "audio_codec": probe.audio_codec,
                "sha256": checksum,
                "thumbnail_key": thumbnail_key,
                "ad_id": ad_id,
                "now": datetime.now(UTC),
            },
        )

    logger.info(
        "Anúncio validado e publicado: ad_id=%s sha256=%s thumbnail=%s",
        ad_id,
        checksum,
        thumbnail_key,
    )


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
