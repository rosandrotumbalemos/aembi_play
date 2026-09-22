"""Testes dos handlers de backup/restore/arquivamento (seção 7) contra o
Postgres e o MinIO reais do docker-compose, com um `FakeDriveBackend`
injetado no lugar do Google Drive de verdade (ver tests/test_drive.py e o
`DriveBackend` Protocol em drive.py) — cumpre a decisão de testar a lógica
contra um cliente fake, sem precisar de credenciais reais do Google."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from aembi_play_media_worker.handlers import (
    handle_archive_local_file,
    handle_backup_to_drive,
    handle_restore_from_drive,
)
from aembi_play_media_worker.storage import ad_video_exists, upload_ad_video
from tests.test_drive import FakeDriveBackend


def _ad_row(db_session: Session, ad_id) -> dict:
    return dict(
        db_session.execute(
            text("SELECT drive_file_id, storage_tier FROM ads WHERE id = :ad_id"),
            {"ad_id": ad_id},
        )
        .mappings()
        .one()
    )


class TestHandleBackupToDrive:
    def test_uploads_video_and_stores_drive_file_id(self, db_session: Session, make_ad, tmp_path):
        storage_key = "ads/backup-test.mp4"
        ad_id = make_ad(storage_key=storage_key, drive_file_id=None)
        local_video = tmp_path / "video.mp4"
        local_video.write_bytes(b"video de teste para backup")
        upload_ad_video(local_video, storage_key)

        backend = FakeDriveBackend()
        handle_backup_to_drive(
            db_session, {"adId": str(ad_id), "storageKey": storage_key}, backend=backend
        )

        row = _ad_row(db_session, ad_id)
        assert row["drive_file_id"] is not None
        assert backend.files[row["drive_file_id"]] == b"video de teste para backup"


class TestHandleRestoreFromDrive:
    def test_downloads_from_drive_and_reuploads_to_minio(
        self, db_session: Session, make_ad, tmp_path
    ):
        backend = FakeDriveBackend()
        drive_file_id = backend.upload(
            _write(tmp_path / "src.mp4", b"conteudo restaurado"), "src.mp4"
        )
        storage_key = "ads/restore-test.mp4"
        ad_id = make_ad(storage_key=storage_key, drive_file_id=drive_file_id, storage_tier="drive")

        handle_restore_from_drive(db_session, {"adId": str(ad_id)}, backend=backend)

        assert ad_video_exists(storage_key)
        assert _ad_row(db_session, ad_id)["storage_tier"] == "local"

    def test_raises_when_ad_has_no_drive_backup(self, db_session: Session, make_ad):
        ad_id = make_ad(drive_file_id=None)

        with pytest.raises(ValueError, match="não tem backup no Drive"):
            handle_restore_from_drive(db_session, {"adId": str(ad_id)}, backend=FakeDriveBackend())

    def test_raises_when_ad_does_not_exist(self, db_session: Session):
        import uuid

        with pytest.raises(ValueError, match="não encontrado"):
            handle_restore_from_drive(
                db_session, {"adId": str(uuid.uuid4())}, backend=FakeDriveBackend()
            )


class TestHandleArchiveLocalFile:
    OLD = datetime.now(UTC) - timedelta(days=30)

    def test_archives_old_ad_without_active_campaign(
        self, db_session: Session, make_ad, tmp_path
    ):
        storage_key = "ads/archive-test.mp4"
        ad_id = make_ad(
            storage_key=storage_key,
            drive_file_id="fake-drive-id",
            storage_tier="local",
            created_at=self.OLD,
        )
        upload_ad_video(_write(tmp_path / "v.mp4", b"video antigo"), storage_key)
        assert ad_video_exists(storage_key)

        handle_archive_local_file(db_session, {"adId": str(ad_id)})

        assert not ad_video_exists(storage_key)
        assert _ad_row(db_session, ad_id)["storage_tier"] == "drive"

    def test_skips_ad_with_active_campaign(
        self, db_session: Session, make_ad, make_active_campaign, tmp_path
    ):
        storage_key = "ads/archive-active-campaign.mp4"
        ad_id = make_ad(
            storage_key=storage_key,
            drive_file_id="fake-drive-id",
            storage_tier="local",
            created_at=self.OLD,
        )
        make_active_campaign(ad_id)
        upload_ad_video(_write(tmp_path / "v.mp4", b"video em campanha"), storage_key)

        handle_archive_local_file(db_session, {"adId": str(ad_id)})

        assert ad_video_exists(storage_key)
        assert _ad_row(db_session, ad_id)["storage_tier"] == "local"

    def test_skips_ad_still_within_retention(self, db_session: Session, make_ad, tmp_path):
        storage_key = "ads/archive-recent.mp4"
        ad_id = make_ad(
            storage_key=storage_key,
            drive_file_id="fake-drive-id",
            storage_tier="local",
            created_at=datetime.now(UTC),
        )
        upload_ad_video(_write(tmp_path / "v.mp4", b"video recente"), storage_key)

        handle_archive_local_file(db_session, {"adId": str(ad_id)})

        assert ad_video_exists(storage_key)
        assert _ad_row(db_session, ad_id)["storage_tier"] == "local"

    def test_skips_ad_without_confirmed_drive_backup(self, db_session: Session, make_ad, tmp_path):
        storage_key = "ads/archive-no-backup.mp4"
        ad_id = make_ad(
            storage_key=storage_key,
            drive_file_id=None,
            storage_tier="local",
            created_at=self.OLD,
        )
        upload_ad_video(_write(tmp_path / "v.mp4", b"sem backup ainda"), storage_key)

        handle_archive_local_file(db_session, {"adId": str(ad_id)})

        assert ad_video_exists(storage_key)
        assert _ad_row(db_session, ad_id)["storage_tier"] == "local"


def _write(path, content: bytes):
    path.write_bytes(content)
    return path
