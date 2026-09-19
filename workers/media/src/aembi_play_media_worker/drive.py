"""Backup/restore no Google Drive (Shared Drive) — PROJECT_BRIEF.md seção 7.

Usa service account + Shared Drive (contas de serviço não têm cota própria)
e upload resumable. Players NUNCA baixam do Drive — só o worker usa esta
integração para backup/arquivamento (seção 7.6).
"""

from __future__ import annotations

from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from .config import get_settings

SCOPES = ["https://www.googleapis.com/auth/drive"]


def _drive_client():
    settings = get_settings()
    if not settings.google_application_credentials:
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS não configurado — ver .env.example"
        )
    credentials = service_account.Credentials.from_service_account_file(
        settings.google_application_credentials, scopes=SCOPES
    )
    return build("drive", "v3", credentials=credentials)


def backup_file(local_path: Path, file_name: str) -> str:
    """Envia o arquivo para o Shared Drive e retorna o `drive_file_id`."""
    settings = get_settings()
    service = _drive_client()
    media = MediaFileUpload(str(local_path), resumable=True)

    file_metadata: dict = {"name": file_name}
    if settings.google_drive_backup_folder_id:
        file_metadata["parents"] = [settings.google_drive_backup_folder_id]

    request = service.files().create(
        body=file_metadata,
        media_body=media,
        supportsAllDrives=True,
        fields="id",
    )
    response = request.execute()
    return response["id"]


def restore_file(drive_file_id: str, destination_path: Path) -> None:
    """Baixa de volta um vídeo arquivado antes de republicar o manifesto."""
    service = _drive_client()
    request = service.files().get_media(fileId=drive_file_id, supportsAllDrives=True)

    with destination_path.open("wb") as f:
        downloader_done = False
        downloader = _MediaDownloader(request, f)
        while not downloader_done:
            downloader_done = downloader.next_chunk()


class _MediaDownloader:
    """Wrapper fino sobre MediaIoBaseDownload para manter a assinatura simples."""

    def __init__(self, request, fh) -> None:
        from googleapiclient.http import MediaIoBaseDownload

        self._downloader = MediaIoBaseDownload(fh, request)

    def next_chunk(self) -> bool:
        _, done = self._downloader.next_chunk()
        return done
