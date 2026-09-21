"""Validação de vídeo (ffprobe) e hashing — PROJECT_BRIEF.md seção 2.4 / 7."""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .config import get_settings

ALLOWED_VIDEO_CODEC = "h264"
ALLOWED_AUDIO_CODEC = "aac"
ALLOWED_CONTAINER = "mp4"


@dataclass
class VideoProbe:
    duration_seconds: float
    video_codec: str | None
    audio_codec: str | None
    format_name: str
    size_bytes: int

    @property
    def is_valid_format(self) -> bool:
        return (
            self.video_codec == ALLOWED_VIDEO_CODEC
            and (self.audio_codec is None or self.audio_codec == ALLOWED_AUDIO_CODEC)
            and ALLOWED_CONTAINER in self.format_name
        )


def probe_video(path: Path) -> VideoProbe:
    """Roda ffprobe e extrai codec/duração/formato do arquivo."""
    settings = get_settings()
    result = subprocess.run(
        [
            settings.ffprobe_bin,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)

    video_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "video"), None
    )
    audio_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None
    )

    return VideoProbe(
        duration_seconds=float(data["format"].get("duration", 0.0)),
        video_codec=video_stream.get("codec_name") if video_stream else None,
        audio_codec=audio_stream.get("codec_name") if audio_stream else None,
        format_name=data["format"].get("format_name", ""),
        size_bytes=int(data["format"].get("size", path.stat().st_size)),
    )


def validate_upload(path: Path) -> tuple[bool, str | None]:
    """Valida tamanho (≤30MB) e formato (MP4 H.264/AAC)."""
    settings = get_settings()
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb > settings.max_upload_size_mb:
        return False, f"Arquivo excede {settings.max_upload_size_mb} MB ({size_mb:.1f} MB)"

    probe = probe_video(path)
    if not probe.is_valid_format:
        return False, (
            f"Formato inválido: vídeo={probe.video_codec}, "
            f"áudio={probe.audio_codec}, container={probe.format_name}. "
            "Esperado MP4 H.264/AAC (transcodificação opcional com ffmpeg)."
        )

    return True, None


def sha256_of_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate_thumbnail(
    input_path: Path, output_path: Path, duration_seconds: float
) -> None:
    """Extrai um frame do vídeo (ffmpeg) pra usar como miniatura na Biblioteca
    (seção 9.2: "Biblioteca em grade com miniatura"). Pega o frame do meio do
    vídeo — costuma representar melhor o conteúdo do que o primeiro frame
    (que às vezes é uma tela preta/fade-in)."""
    settings = get_settings()
    timestamp = max(duration_seconds / 2, 0.0)
    subprocess.run(
        [
            settings.ffmpeg_bin,
            "-y",
            "-ss",
            f"{timestamp:.2f}",
            "-i",
            str(input_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=480:-1",
            "-q:v",
            "4",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )


def transcode_to_h264_aac(input_path: Path, output_path: Path) -> None:
    """Transcodificação opcional (ffmpeg) para o formato padrão do sistema."""
    settings = get_settings()
    subprocess.run(
        [
            settings.ffmpeg_bin,
            "-y",
            "-i",
            str(input_path),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )
