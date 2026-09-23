# Aembi Play

Plataforma de sinalização digital (digital signage) — anunciantes contratam
espaço em telas por período e plano; o sistema monta e distribui a
programação de cada tela automaticamente.

Leia **[docs/PROJECT_BRIEF.md](./docs/PROJECT_BRIEF.md)** antes de qualquer
sessão de desenvolvimento — ele tem todas as decisões do projeto (stack,
arquitetura, modelo de dados, protocolo do player e roadmap).

## Estrutura do monorepo

```
apps/
├── web/              # Next.js (App Router) — painel administrativo + API
└── player/           # PWA em TypeScript — roda em tela cheia no dispositivo
workers/
└── media/            # Worker Python (uv) — validação de vídeo, backup, expiração
packages/
├── database/         # Schema e migrations (Drizzle) — dono único do schema
└── shared/           # Contratos Zod (manifesto do player, jobs, etc.)
scripts/
└── provision/        # PowerShell — provisionamento de players Windows (Fase 3)
docs/
└── PROJECT_BRIEF.md  # Documento de contexto do projeto
docker-compose.yml    # PostgreSQL + MinIO
```

Gerenciador: **pnpm + Turborepo**.

## Rodando localmente

### 1. Pré-requisitos

- Node.js ≥ 20
- pnpm (`corepack enable` já habilita a versão fixada no `package.json`)
- Python ≥ 3.12 com [`uv`](https://docs.astral.sh/uv/)
- Docker + Docker Compose

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

### 3. Suba PostgreSQL e MinIO

```bash
docker compose up -d
```

Isso sobe o Postgres, o MinIO e cria automaticamente o bucket
`aembi-ads` (serviço `minio-init`, que roda uma vez e sai).

> **Nota:** as imagens oficiais do MinIO passaram a ser publicadas em
> `quay.io/minio/*` em vez do Docker Hub — já configurado no
> `docker-compose.yml`.

### 4. Instale as dependências do monorepo (TypeScript)

```bash
pnpm install
```

### 5. Gere e aplique as migrations do banco

```bash
pnpm db:generate   # gera o SQL a partir de packages/database/src/schema.ts
pnpm db:migrate    # aplica no Postgres local
```

### 6. Suba o painel (apps/web)

```bash
pnpm --filter @aembi-play/web dev
# http://localhost:3000
```

### 7. Suba o player (apps/player)

```bash
pnpm --filter @aembi-play/player dev
# http://localhost:4000
```

Ao abrir, o player chama `POST /api/player/register` e mostra um código de
pareamento; a vinculação a uma tela existente pelo painel ainda será
implementada na Fase 2.

### 8. Suba o site institucional (apps/site)

```bash
pnpm --filter @aembi-play/site dev
# http://localhost:3100
```

Site de apresentação (página inicial, quem somos, como funciona e contato)
com um botão "Entrar" que leva a uma tela de login própria antes de mandar
o usuário para o painel de verdade (`NEXT_PUBLIC_PAINEL_URL`, apps/web).
Roda numa porta separada (3100) para não conflitar com o painel.

### 9. Suba o worker (workers/media)

```bash
cd workers/media
uv sync
uv run aembi-media-worker
```

### Problemas comuns

**`autenticação do tipo senha falhou` (`28P01`) ao rodar `pnpm db:migrate`, mesmo
com a senha certa no `.env` — no Windows.** No Windows com Docker Desktop
(WSL2), o Hyper-V às vezes reserva dinamicamente faixas de porta que colidem
com a 5432, fazendo a conexão TCP abrir normalmente mas os dados chegarem
corrompidos no Postgres — o sintoma parece erro de senha, mas não é. Por
isso o `docker-compose.yml` já publica o Postgres na porta **55432** (não a
5432 padrão) por padrão — confira se o seu `.env` também usa `55432` em
`POSTGRES_PORT` e `DATABASE_URL` (copie de novo de `.env.example` se tiver
um `.env` antigo). Para confirmar o diagnóstico, rode:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Se `5432` cair dentro de alguma faixa listada, é exatamente isso.

## Comandos úteis (raiz do monorepo)

| Comando | Descrição |
|---|---|
| `pnpm dev` | roda `dev` em todos os apps via Turborepo |
| `pnpm build` | build de produção de todos os apps |
| `pnpm lint` | lint/type-check em todos os pacotes |
| `pnpm type-check` | apenas checagem de tipos |
| `pnpm test` | testes de todos os pacotes |
| `pnpm db:studio` | abre o Drizzle Studio |

## Protocolo do player

Ver `docs/PROJECT_BRIEF.md`, seção 5. Resumo:

1. **Pareamento:** `POST /api/player/register` → código curto + token do dispositivo.
2. **Manifesto:** `GET /api/player/manifest` (polling com ETag) → playlist, orientação e loop.
3. **Comandos:** WebSocket/SSE para ações imediatas (a implementar).
4. **Heartbeat:** `POST /api/player/heartbeat` a cada 30–60s.
5. **Proof of play:** exibições registradas e enviadas em lote (a implementar).

## Convenções

- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/).
- Branches por funcionalidade: `feat/`, `fix/`, `chore/` — merge via pull request.
- `.env` nunca vai para o repositório (`.gitignore`); credenciais nunca são commitadas.
- Todo o ambiente local roda em Docker, para ficar igual ao de produção.

## Status (Fase 1 — Núcleo)

- [x] Monorepo (pnpm/Turborepo) + docker-compose (PostgreSQL, MinIO)
- [x] Schema e migrations iniciais (Drizzle)
- [x] Cadastro de telas com pareamento (API) e orientação (schema)
- [x] Player: pareamento, manifesto (polling + ETag), cache offline (Cache API), reprodução
- [x] Heartbeat + status no painel (Online / Sem sinal / Offline)
- [ ] Upload de anúncios com validação (worker escrito, falta UI de upload)
- [ ] Teste real com 1–2 telas por algumas semanas

Ver `docs/PROJECT_BRIEF.md` seção 10 para o roadmap completo.
