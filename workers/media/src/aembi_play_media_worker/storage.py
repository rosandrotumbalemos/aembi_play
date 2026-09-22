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


def upload_ad_video(local_path: Path, storage_key: str) -> None:
    """Reenvia um vídeo pro MinIO na mesma `storage_key` de sempre — usado
    pelo restore (seção 7.5): o vídeo volta pro mesmo lugar de onde saiu
    quando foi arquivado, então nada mais no sistema (manifesto, URL de
    download do player) precisa mudar."""
    settings = get_settings()
    _client().upload_file(
        str(local_path),
        settings.minio_bucket,
        storage_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )


def delete_ad_video(storage_key: str) -> None:
    """Remove o vídeo do MinIO local (arquivamento, seção 7.4) — só chamado
    depois que o backup no Drive já foi confirmado (`ads.drive_file_id`
    presente), nunca antes."""
    settings = get_settings()
    _client().delete_object(Bucket=settings.minio_bucket, Key=storage_key)


def ad_video_exists(storage_key: str) -> bool:
    """Usado pelos testes/diagnóstico pra confirmar presença/ausência do
    objeto no MinIO sem precisar baixar o arquivo inteiro."""
    settings = get_settings()
    from botocore.exceptions import ClientError

    try:
        _client().head_object(Bucket=settings.minio_bucket, Key=storage_key)
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
            return False
        raise
