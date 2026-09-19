# @aembi-play/database

Schema e migrations do Aembi Play, via Drizzle ORM. **Este pacote é o único
dono do schema** — o worker Python (`workers/media`) lê e escreve nas mesmas
tabelas, mas não gera migrations próprias (PROJECT_BRIEF.md seção 3.1).

## Comandos

```bash
pnpm --filter @aembi-play/database generate   # gera SQL a partir do schema.ts
pnpm --filter @aembi-play/database migrate    # aplica as migrations pendentes
pnpm --filter @aembi-play/database push       # sincroniza o schema direto (dev)
pnpm --filter @aembi-play/database studio     # abre o Drizzle Studio
```

Requer `DATABASE_URL` no ambiente (ver `.env.example` na raiz).

## Tabelas (Fase 1)

`users`, `advertisers`, `categories`, `ads`, `screens`, `plans`, `campaigns`,
`campaign_screens`, `playlists`, `audit_logs`, `play_logs`, `jobs` — ver
PROJECT_BRIEF.md seção 6 para o detalhamento de cada uma.
