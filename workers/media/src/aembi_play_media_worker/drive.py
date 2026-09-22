"""Backup/restore no Google Drive (Shared Drive) — PROJECT_BRIEF.md seção 7.

Usa service account + Shared Drive (contas de serviço não têm cota própria)
e upload resumable. Players NUNCA baixam do Drive — só o worker usa esta
integração para backup/arquivamento (seção 7.6).

`DriveBackend` é o ponto de injeção pros testes (ver tests/test_drive.py):
`backup_file`/`restore_file` recebem um backend opcional — em produção é
sempre `GoogleDriveBackend` (lazy, só autentica quando efetivamente chamado),
nos testes é um fake em memória, sem precisar mockar as classes internas do
`googleapiclient`. Credenciais reais (GOOGLE_APPLICATION_CREDENTIALS) ainda
não foram configuradas neste ambiente — a integração real fica pronta pra
quando chegarem, testada até lá só contra o fake.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from .config import get_settings

SCOPES = ["https://www.googleapis.com/auth/drive"]


class DriveBackend(Protocol):
    """Abstração mínima que `backup_file`/`restore_file` precisam — só upload
    e download por id. Qualquer implementação (real ou fake) que cumpra isto
    serve."""

    def upload(self, local_path: Path, file_name: str) -> str:
        """Envia o arquivo e retorna o `drive_file_id`."""
        ...

    def download(self, file_id: str, destination: Path) -> None:
        """Baixa o arquivo `file_id` para `destination`."""
        ...


class GoogleDriveBackend:
    """Implementação real via `google-api-python-client`, autenticação lazy
    (só na primeira chamada) pra não exigir credenciais em processos do
    worker que nunca fazem backup/restore (ex.: rodando só `validate_video`
    num ambiente sem Drive configurado ainda)."""

    def __init__(self) -> None:
        self._service = None

    def _client(self):
        if self._service is None:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            settings = get_settings()
            if not settings.google_application_credentials:
                raise RuntimeError(
                    "GOOGLE_APPLICATION_CREDENTIALS não configurado — ver .env.example"
                )
            credentials = service_account.Credentials.from_service_account_file(
                settings.google_application_credentials, scopes=SCOPES
            )
            self._service = build("drive", "v3", credentials=credentials)
        return self._service

    def upload(self, local_path: Path, file_name: str) -> str:
        from googleapiclient.http import MediaFileUpload

        settings = get_settings()
        media = MediaFileUpload(str(local_path), resumable=True)

        file_metadata: dict = {"name": file_name}
        if settings.google_drive_backup_folder_id:
            file_metadata["parents"] = [settings.google_drive_backup_folder_id]

        request = self._client().files().create(
            body=file_metadata,
            media_body=media,
            supportsAllDrives=True,
            fields="id",
        )
        response = request.execute()
        return response["id"]

    def download(self, file_id: str, destination: Path) -> None:
        from googleapiclient.http import MediaIoBaseDownload

        request = self._client().files().get_media(fileId=file_id, supportsAllDrives=True)
        with destination.open("wb") as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()


def backup_file(local_path: Path, file_name: str, backend: DriveBackend | None = None) -> str:
    """Envia o arquivo para o Shared Drive e retorna o `drive_file_id`."""
    backend = backend or GoogleDriveBackend()
    return backend.upload(local_path, file_name)


def restore_file(
    drive_file_id: str, destination_path: Path, backend: DriveBackend | None = None
) -> None:
    """Baixa de volta um vídeo arquivado antes de republicar o manifesto."""
    backend = backend or GoogleDriveBackend()
    backend.download(drive_file_id, destination_path)
