"""Testes básicos do módulo de validação de vídeo."""

import hashlib

from aembi_play_media_worker.media import sha256_of_file


def test_sha256_of_file(tmp_path):
    content = b"aembi play"
    file_path = tmp_path / "sample.bin"
    file_path.write_bytes(content)

    expected = hashlib.sha256(content).hexdigest()
    assert sha256_of_file(file_path) == expected
