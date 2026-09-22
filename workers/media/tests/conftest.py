"""Fixtures compartilhadas — testes de handlers/scheduler rodam contra o
Postgres e o MinIO reais do docker-compose (não há banco/mocks separados: o
worker não tem migrations próprias, então "testar de verdade" significa usar
o mesmo Postgres que packages/database migrou — ver db.py).

Isolamento: cada teste roda dentro de uma transação aberta na conexão e
revertida no fim (`connection.begin()` + `trans.rollback()`), então nenhum
handler chama `session.commit()` (isso é responsabilidade do chamador em
produção — ver worker.py) e nada escrito por um teste sobrevive a ele.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from aembi_play_media_worker.db import engine


@pytest.fixture()
def db_session() -> Iterator[Session]:
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture()
def make_advertiser(db_session: Session):
    """Cria um anunciante mínimo e retorna seu id (uuid)."""
    from sqlalchemy import text

    def _make(name: str = "Anunciante de teste") -> uuid.UUID:
        row = db_session.execute(
            text("INSERT INTO advertisers (name) VALUES (:name) RETURNING id"),
            {"name": name},
        ).first()
        return row[0]

    return _make


@pytest.fixture()
def make_plan(db_session: Session):
    from sqlalchemy import text

    def _make(
        *,
        insertions_per_cycle: int = 10,
        max_duration_seconds: int = 30,
        max_screens: int = 5,
    ) -> uuid.UUID:
        row = db_session.execute(
            text(
                """
                INSERT INTO plans (name, insertions_per_cycle, max_duration_seconds, max_screens)
                VALUES (
                    'Plano de teste', :insertions_per_cycle, :max_duration_seconds, :max_screens
                )
                RETURNING id
                """
            ),
            {
                "insertions_per_cycle": insertions_per_cycle,
                "max_duration_seconds": max_duration_seconds,
                "max_screens": max_screens,
            },
        ).first()
        return row[0]

    return _make


@pytest.fixture()
def make_ad(db_session: Session, make_advertiser):
    from sqlalchemy import text

    def _make(
        *,
        storage_key: str | None = None,
        drive_file_id: str | None = None,
        storage_tier: str = "local",
        status: str = "publicado",
        created_at: datetime | None = None,
    ) -> uuid.UUID:
        storage_key = storage_key or f"ads/{uuid.uuid4()}.mp4"
        row = db_session.execute(
            text(
                """
                INSERT INTO ads (
                    advertiser_id, title, storage_key, drive_file_id, size_bytes,
                    duration_seconds, sha256, storage_tier, status, created_at
                ) VALUES (
                    :advertiser_id, 'Anúncio de teste', :storage_key, :drive_file_id, 1024,
                    10, :sha256, :storage_tier, :status, :created_at
                )
                RETURNING id
                """
            ),
            {
                "advertiser_id": make_advertiser(),
                "storage_key": storage_key,
                "drive_file_id": drive_file_id,
                "sha256": uuid.uuid4().hex + uuid.uuid4().hex,
                "storage_tier": storage_tier,
                "status": status,
                "created_at": created_at or datetime.now(UTC),
            },
        ).first()
        return row[0]

    return _make


@pytest.fixture()
def make_active_campaign(db_session: Session, make_advertiser, make_plan):
    """Cria uma campanha ativa e dentro da validade pro ad informado — usada
    pra testar que o arquivamento (handlers/scheduler) respeita campanha
    ativa mesmo depois de vencida a retenção."""
    from datetime import timedelta

    from sqlalchemy import text

    def _make(ad_id: uuid.UUID) -> uuid.UUID:
        now = datetime.now(UTC)
        row = db_session.execute(
            text(
                """
                INSERT INTO campaigns (
                    advertiser_id, ad_id, plan_id, start_date, end_date, active
                ) VALUES (
                    :advertiser_id, :ad_id, :plan_id, :start_date, :end_date, true
                )
                RETURNING id
                """
            ),
            {
                "advertiser_id": make_advertiser(),
                "ad_id": ad_id,
                "plan_id": make_plan(),
                "start_date": now - timedelta(days=1),
                "end_date": now + timedelta(days=1),
            },
        ).first()
        return row[0]

    return _make
