"""Configuração via variáveis de ambiente (ver .env.example na raiz)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None) -> str:
    value = os.getenv(key, default)
    if value is None:
        raise RuntimeError(f"Variável de ambiente obrigatória não definida: {key}")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    minio_endpoint: str
    minio_port: int
    minio_bucket: str
    minio_root_user: str
    minio_root_password: str
    minio_use_ssl: bool
    storage_local_quota_mb: int
    storage_retention_days: int
    max_upload_size_mb: int
    ffmpeg_bin: str
    ffprobe_bin: str
    worker_poll_interval_seconds: float
    google_application_credentials: str | None
    google_drive_shared_drive_id: str | None
    google_drive_backup_folder_id: str | None

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=_env("DATABASE_URL"),
            minio_endpoint=_env("MINIO_ENDPOINT", "localhost"),
            minio_port=int(_env("MINIO_PORT", "9000")),
            minio_bucket=_env("MINIO_BUCKET", "aembi-ads"),
            minio_root_user=_env("MINIO_ROOT_USER", "aembi_admin"),
            minio_root_password=_env("MINIO_ROOT_PASSWORD", "aembi_dev_password"),
            minio_use_ssl=_env("MINIO_USE_SSL", "false").lower() == "true",
            storage_local_quota_mb=int(_env("STORAGE_LOCAL_QUOTA_MB", "1024")),
            storage_retention_days=int(_env("STORAGE_RETENTION_DAYS", "7")),
            max_upload_size_mb=int(_env("MAX_UPLOAD_SIZE_MB", "30")),
            ffmpeg_bin=_env("FFMPEG_BIN", "ffmpeg"),
            ffprobe_bin=_env("FFPROBE_BIN", "ffprobe"),
            worker_poll_interval_seconds=float(_env("WORKER_POLL_INTERVAL_SECONDS", "5")),
            google_application_credentials=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
            google_drive_shared_drive_id=os.getenv("GOOGLE_DRIVE_SHARED_DRIVE_ID"),
            google_drive_backup_folder_id=os.getenv("GOOGLE_DRIVE_BACKUP_FOLDER_ID"),
        )


@lru_cache
def get_settings() -> Settings:
    """Carrega a configuração de forma preguiçosa (só ao ser usada).

    Evita que um simples `import` deste pacote falhe quando DATABASE_URL
    ainda não está definida (ex.: testes que só exercitam utilitários puros).
    """
    return Settings.from_env()
