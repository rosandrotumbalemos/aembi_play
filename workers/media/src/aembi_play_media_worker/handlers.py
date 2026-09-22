"""Um handler por tipo de job (ver packages/shared JobTypeSchema)."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings
from .drive import DriveBackend

logger = logging.getLogger(__name__)

JobHandler = Any  # Callable[[Session, dict], None] — evita import circular


def _enqueue_job(session: Session, job_type: str, payload: dict) -> None:
    """Insere um job na mesma fila que apps/web usa — ver packages/database
    `jobs` (seção 3.1). Chamado de dentro de um handler, na MESMA transação
    do job que está sendo processado."""
    import json

    session.execute(
        text("INSERT INTO jobs (id, type, payload) VALUES (:id, :type, CAST(:payload AS jsonb))"),
        {"id": uuid.uuid4(), "type": job_type, "payload": json.dumps(payload)},
    )


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

    # Backup no Drive disparado imediatamente após o upload (seção 7.3) —
    # só depois de validado, pra não gastar cota do Drive com um upload que
    # nem chegou a ser um MP4 válido.
    _enqueue_job(session, "backup_to_drive", {"adId": ad_id, "storageKey": storage_key})

    logger.info(
        "Anúncio validado e publicado: ad_id=%s sha256=%s thumbnail=%s",
        ad_id,
        checksum,
        thumbnail_key,
    )


def handle_backup_to_drive(
    session: Session, payload: dict, backend: DriveBackend | None = None
) -> None:
    """Backup no Google Drive, disparado imediatamente após o upload
    (seção 7.3) — payload: {"adId": "...", "storageKey": "ads/<uuid>.mp4"}.
    Baixa do MinIO (o worker e quem enfileira o job nem sempre compartilham
    filesystem) pra um arquivo temporário e envia esse arquivo pro Drive.
    """
    import tempfile
    from pathlib import Path

    from .drive import backup_file
    from .storage import download_ad_video

    ad_id = payload["adId"]
    storage_key = payload["storageKey"]

    with tempfile.TemporaryDirectory() as tmp_dir:
        local_path = Path(tmp_dir) / Path(storage_key).name
        download_ad_video(storage_key, local_path)
        drive_file_id = backup_file(local_path, file_name=local_path.name, backend=backend)

    session.execute(
        text("UPDATE ads SET drive_file_id = :drive_file_id, updated_at = :now WHERE id = :ad_id"),
        {"drive_file_id": drive_file_id, "ad_id": ad_id, "now": datetime.now(UTC)},
    )
    logger.info("Backup no Drive concluído: ad_id=%s -> drive_file_id=%s", ad_id, drive_file_id)


def handle_restore_from_drive(
    session: Session, payload: dict, backend: DriveBackend | None = None
) -> None:
    """Restaura um vídeo arquivado antes de republicar o manifesto (seção
    7.5) — payload: {"adId": "..."}. Busca `drive_file_id`/`storage_key` no
    banco (em vez de vir no payload) porque quem enfileira este job
    (apps/web, ao gerar uma playlist que referencia um anúncio arquivado)
    não deveria precisar saber esses detalhes — só o adId.
    """
    import tempfile
    from pathlib import Path

    from .drive import restore_file
    from .storage import upload_ad_video

    ad_id = payload["adId"]

    row = session.execute(
        text("SELECT storage_key, drive_file_id FROM ads WHERE id = :ad_id"),
        {"ad_id": ad_id},
    ).mappings().first()

    if row is None:
        raise ValueError(f"Anúncio não encontrado: {ad_id}")
    if not row["drive_file_id"]:
        raise ValueError(
            f"Anúncio {ad_id} não tem backup no Drive (drive_file_id ausente) — nada a restaurar"
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        local_path = Path(tmp_dir) / Path(row["storage_key"]).name
        restore_file(row["drive_file_id"], local_path, backend=backend)
        upload_ad_video(local_path, row["storage_key"])

    session.execute(
        text("UPDATE ads SET storage_tier = 'local', updated_at = :now WHERE id = :ad_id"),
        {"ad_id": ad_id, "now": datetime.now(UTC)},
    )
    logger.info("Restaurado do Drive: ad_id=%s storage_key=%s", ad_id, row["storage_key"])


def _ad_has_active_campaign(session: Session, ad_id: str, now: datetime) -> bool:
    """Mesmo critério de elegibilidade usado em
    apps/web/src/lib/playlist-generator.ts (active=true, dentro do
    intervalo start/end) — um anúncio "em campanha ativa" não pode ser
    arquivado, mesmo que já tenha passado da retenção."""
    row = session.execute(
        text(
            """
            SELECT 1 FROM campaigns
            WHERE ad_id = :ad_id AND active = true
              AND start_date <= :now AND end_date >= :now
            LIMIT 1
            """
        ),
        {"ad_id": ad_id, "now": now},
    ).first()
    return row is not None


def handle_archive_local_file(session: Session, payload: dict) -> None:
    """Cron diário (seção 7.4): remove do MinIO local os anúncios com mais
    de `STORAGE_RETENTION_DAYS` dias que não estão em nenhuma campanha
    ativa — mantém `drive_file_id`, só troca `storage_tier` pra "drive".
    payload: {"adId": "..."} — um job por anúncio, enfileirado pelo
    scheduler (ver scheduler.py) depois de já ter filtrado os candidatos;
    aqui a elegibilidade é CONFERIDA DE NOVO (defesa em profundidade: uma
    campanha pode ter sido criada depois que o job foi enfileirado).
    """
    from .storage import delete_ad_video

    ad_id = payload["adId"]
    settings = get_settings()
    now = datetime.now(UTC)

    row = session.execute(
        text(
            "SELECT storage_key, drive_file_id, storage_tier, created_at FROM ads WHERE id = :ad_id"
        ),
        {"ad_id": ad_id},
    ).mappings().first()

    if row is None:
        raise ValueError(f"Anúncio não encontrado: {ad_id}")
    if row["storage_tier"] != "local":
        logger.info(
            "Anúncio %s já não está em 'local' (%s) — nada a fazer", ad_id, row["storage_tier"]
        )
        return
    if not row["drive_file_id"]:
        # Nunca arquiva sem um backup confirmado — sem isso, arquivar
        # significaria perder o arquivo de vez.
        logger.warning("Anúncio %s ainda sem backup no Drive — adiando arquivamento", ad_id)
        return
    if row["created_at"] > now - timedelta(days=settings.storage_retention_days):
        logger.info("Anúncio %s ainda dentro da retenção — adiando arquivamento", ad_id)
        return
    if _ad_has_active_campaign(session, ad_id, now):
        logger.info("Anúncio %s está em campanha ativa — adiando arquivamento", ad_id)
        return

    delete_ad_video(row["storage_key"])
    session.execute(
        text("UPDATE ads SET storage_tier = 'drive', updated_at = :now WHERE id = :ad_id"),
        {"ad_id": ad_id, "now": now},
    )
    logger.info("Anúncio arquivado (removido do MinIO local): ad_id=%s", ad_id)


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
