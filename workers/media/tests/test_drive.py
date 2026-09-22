"""Testes de drive.py contra um DriveBackend fake em memória (ver
`DriveBackend` Protocol em drive.py) — não exigem GOOGLE_APPLICATION_CREDENTIALS
nem tocam a API real do Google Drive. A integração real (`GoogleDriveBackend`)
fica pronta pro dia em que credenciais reais chegarem (ver .env.example), mas
é testada aqui só até o ponto de autenticação lazy (sem credencial -> erro
claro), nunca contra a API de verdade."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from aembi_play_media_worker.drive import backup_file, restore_file


class FakeDriveBackend:
    """Implementação em memória do Protocol `DriveBackend` — grava os bytes
    enviados num dict e devolve na hora do download, sem rede."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.uploaded_names: list[str] = []

    def upload(self, local_path: Path, file_name: str) -> str:
        file_id = str(uuid.uuid4())
        self.files[file_id] = local_path.read_bytes()
        self.uploaded_names.append(file_name)
        return file_id

    def download(self, file_id: str, destination: Path) -> None:
        destination.write_bytes(self.files[file_id])


def test_backup_file_uploads_and_returns_drive_file_id(tmp_path: Path) -> None:
    backend = FakeDriveBackend()
    local_path = tmp_path / "video.mp4"
    local_path.write_bytes(b"conteudo do video")

    drive_file_id = backup_file(local_path, file_name="video.mp4", backend=backend)

    assert drive_file_id in backend.files
    assert backend.files[drive_file_id] == b"conteudo do video"
    assert backend.uploaded_names == ["video.mp4"]


def test_restore_file_downloads_by_id(tmp_path: Path) -> None:
    backend = FakeDriveBackend()
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"outro conteudo")
    drive_file_id = backup_file(source_path, file_name="source.mp4", backend=backend)

    destination = tmp_path / "restored.mp4"
    restore_file(drive_file_id, destination, backend=backend)

    assert destination.read_bytes() == b"outro conteudo"


def test_backup_file_without_backend_uses_google_drive_backend_lazily(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Sem `backend=`, `backup_file` usa `GoogleDriveBackend` por padrão — só
    confirma que a autenticação lazy dispara (e falha com uma mensagem clara
    sem credenciais configuradas), não a integração real com a API."""
    import aembi_play_media_worker.drive as drive_module

    class FakeSettingsWithoutCredentials:
        google_application_credentials = None
        google_drive_backup_folder_id = None

    # drive.py importa `get_settings` no nível do módulo (`from .config import
    # get_settings`), então o monkeypatch precisa mirar o nome já vinculado
    # dentro de drive.py, não o atributo em config.py (reatribuir lá não
    # afetaria essa referência já resolvida).
    monkeypatch.setattr(drive_module, "get_settings", lambda: FakeSettingsWithoutCredentials())

    local_path = tmp_path / "video.mp4"
    local_path.write_bytes(b"x")

    with pytest.raises(RuntimeError, match="GOOGLE_APPLICATION_CREDENTIALS"):
        backup_file(local_path, file_name="video.mp4")
