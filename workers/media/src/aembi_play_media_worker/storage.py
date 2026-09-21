"""Cliente S3 (MinIO) — o worker baixa o vídeo enviado pelo painel para
validar com ffprobe antes de publicar. Ver `apps/web/src/lib/storage.ts`,
que faz o upload original com as mesmas credenciais."""

from __future__ import annotations

from pathlib import Path

import boto3
from botocore.client import Config as BotoConfig

from .config import get_settings


def _client():
    settings = get_settings()
    scheme = "https" if settings.minio_use_ssl else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.minio_endpoint}:{settings.minio_port}",
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",  # MinIO ignora a região, mas o SDK exige um valor
    )


def download_ad_video(storage_key: str, destination: Path) -> None:
    """Baixa o objeto `storage_key` do bucket de anúncios para `destination`."""
    settings = get_settings()
    _client().download_file(settings.minio_bucket, storage_key, str(destination))


def upload_ad_thumbnail(local_path: Path, storage_key: str) -> None:
    """Sobe a miniatura gerada (ffmpeg) pro mesmo bucket dos vídeos."""
    settings = get_settings()
    _client().upload_file(
        str(local_path),
        settings.minio_bucket,
        storage_key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )
