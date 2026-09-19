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
- `expire_campaign` — encerra campanhas vencidas e ajusta as playlists.

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
├── drive.py      # backup/restore no Google Drive
├── handlers.py   # um handler por tipo de job
└── worker.py     # loop principal
```

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
