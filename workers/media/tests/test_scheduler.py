"""Testes da varredura diária de arquivamento (seção 7.4) contra o Postgres
real — `run_sweep` enfileira um job `archive_local_file` por anúncio
elegível na mesma tabela `jobs` que apps/web usa."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from aembi_play_media_worker.scheduler import run_sweep

OLD = datetime.now(UTC) - timedelta(days=30)


def _pending_archive_jobs_for(db_session: Session, ad_id) -> list:
    return db_session.execute(
        text(
            """
            SELECT id FROM jobs
            WHERE type = 'archive_local_file' AND status = 'pending'
              AND payload->>'adId' = :ad_id
            """
        ),
        {"ad_id": str(ad_id)},
    ).all()


def test_run_sweep_enqueues_job_for_eligible_ad(db_session: Session, make_ad):
    ad_id = make_ad(drive_file_id="fake-drive-id", storage_tier="local", created_at=OLD)

    enqueued = run_sweep(db_session)

    assert enqueued >= 1
    assert len(_pending_archive_jobs_for(db_session, ad_id)) == 1


def test_run_sweep_does_not_duplicate_pending_job(db_session: Session, make_ad):
    ad_id = make_ad(drive_file_id="fake-drive-id", storage_tier="local", created_at=OLD)

    run_sweep(db_session)
    run_sweep(db_session)

    assert len(_pending_archive_jobs_for(db_session, ad_id)) == 1


def test_run_sweep_skips_ad_with_active_campaign(
    db_session: Session, make_ad, make_active_campaign
):
    ad_id = make_ad(drive_file_id="fake-drive-id", storage_tier="local", created_at=OLD)
    make_active_campaign(ad_id)

    run_sweep(db_session)

    assert _pending_archive_jobs_for(db_session, ad_id) == []


def test_run_sweep_skips_ad_without_drive_backup(db_session: Session, make_ad):
    ad_id = make_ad(drive_file_id=None, storage_tier="local", created_at=OLD)

    run_sweep(db_session)

    assert _pending_archive_jobs_for(db_session, ad_id) == []


def test_run_sweep_skips_recent_ad(db_session: Session, make_ad):
    ad_id = make_ad(
        drive_file_id="fake-drive-id", storage_tier="local", created_at=datetime.now(UTC)
    )

    run_sweep(db_session)

    assert _pending_archive_jobs_for(db_session, ad_id) == []
