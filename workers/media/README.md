# workers/media

Worker Python (gerenciado com `uv`) do Aembi Play. Consome a fila
compartilhada `jobs` no PostgreSQL (a mesma que o `apps/web` escreve) e
processa, em background:

- `validate_video` — valida MIME, tamanho (≤ 30 MB) e formato (MP4 H.264/AAC)
  via `ffprobe`, opcionalmente transcodifica com `ffmpeg`.
- `backup_to_drive` — envia o arquivo para o Google Drive (Shared Drive)
  logo após o upload.
- `restore_from_drive` — baixa de volta um vídeo arquivado antes de
  republicar o manifesto.
- `archive_local_file` — cron diário: remove do MinIO local os arquivos
  com mais de 7 dias que não estão em campanha ativa (mantém `drive_file_id`).
  Não há um serviço de cron separado (o `docker-compose.yml` só tem
  postgres/minio/app/worker): o próprio loop do worker roda a varredura
  (`scheduler.py`) no máximo uma vez por dia de calendário e enfileira um job
  destes por anúncio elegível.
- `expire_campaign` — encerra campanhas vencidas e ajusta as playlists.

Players **nunca** baixam do Google Drive — só este worker fala com o Drive
(backup/restauração). Os players sempre baixam o vídeo do `apps/web`
(`/api/ads/:id/video`), que serve do MinIO.

O Python **não tem migrations próprias** — o schema é de propriedade do
Drizzle (`packages/database`). Este worker só lê e escreve nas mesmas
tabelas.

## Rodando localmente

```bash
cd workers/media
uv sync
cp ../../.env.example ../../.env   # se ainda não existir
uv run aembi-media-worker
```

## Estrutura

```
src/aembi_play_media_worker/
├── config.py     # variáveis de ambiente
├── db.py         # engine/session SQLAlchemy
├── queue.py      # SELECT ... FOR UPDATE SKIP LOCKED na tabela jobs
├── media.py      # validação de vídeo (ffprobe) + sha256
├── storage.py    # upload/download/delete no MinIO
├── drive.py      # backup/restore no Google Drive (backend injetável, ver Testes)
├── handlers.py   # um handler por tipo de job
├── scheduler.py  # varredura diária de arquivamento (seção 7.4)
└── worker.py     # loop principal
```

## Testes

```bash
cd workers/media
uv run pytest
```

Os testes de `drive.py` rodam contra um `DriveBackend` fake em memória
(`tests/test_drive.py`), sem precisar de `GOOGLE_APPLICATION_CREDENTIALS` —
`backup_file`/`restore_file` aceitam um `backend` opcional para isso (em
produção o padrão é sempre o `GoogleDriveBackend` real). Os testes de
`handlers.py` e `scheduler.py` rodam contra o Postgres e o MinIO reais do
`docker-compose.yml` (cada teste abre uma transação e a desfaz no final, sem
sujar os dados), também com o Drive fake injetado. A integração real com o
Google Drive fica pronta para quando credenciais reais forem configuradas,
mas ainda não foi exercitada contra a API de verdade.

## Contratos compartilhados

Os payloads dos jobs seguem os schemas Zod de `packages/shared`, exportados
como JSON Schema e convertidos para modelos Pydantic:

```bash
pnpm --filter @aembi-play/shared schema:export
uv run datamodel-codegen \
  --input ../../packages/shared/dist/json-schema \
  --input-file-type jsonschema \
  --output src/aembi_play_media_worker/schemas.py
```
