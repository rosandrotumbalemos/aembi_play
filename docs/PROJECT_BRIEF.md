# Aembi Play — Briefing do Projeto

> Documento de contexto do projeto. Leia antes de qualquer sessão de desenvolvimento.
> Nome da plataforma: **Aembi Play**
> Referência visual: https://claude.ai/artifact/CLKTk2hZM5L9JuBy4M7SaN

---

## 1. Visão geral

Plataforma web de **sinalização digital (digital signage)** para gerir e exibir vídeos publicitários em telas físicas. O modelo é de **rede de mídia**: anunciantes contratam espaço em telas por um período e um plano, e o sistema monta e distribui automaticamente a programação de cada tela.

O sistema tem três partes:

- **Painel administrativo:** cadastro de anunciantes, anúncios, telas, planos e campanhas; programação; monitoramento; histórico.
- **Player:** página web que roda em tela cheia no dispositivo ligado à TV e reproduz a playlist da tela, inclusive offline.
- **Worker:** processamento assíncrono (validação de vídeo, backup no Google Drive, arquivamento, expiração de campanhas).

---

## 2. Regras de negócio

### 2.1 Fluxo de cadastro de campanha

Nome (anunciante) → anúncio → telas contratadas → horário → data de início → data de término → plano

No painel, isso é um assistente em etapas com resumo ao lado. Ao confirmar, o sistema gera a programação de cada tela afetada.

### 2.2 Funcionalidades do administrador

- Adicionar e remover anúncios
- Alterar a programação
- Controlar cada tela (orientação, recarregar player, tela de emergência, desparear)
- Criar playlists
- Programar horários (faixa horária + dias da semana)
- Definir validade dos anúncios (início e término; saída automática ao vencer)
- Verificar se os players estão online

### 2.3 Ciclo e planos

- Cada tela repete um **ciclo** (loop). Referência inicial: **5 minutos, dividido em espaços de 15 segundos = 20 espaços por ciclo.**
- Vídeo de 15 s ocupa 1 espaço; de 30 s ocupa 2.
- O **plano** define: inserções por ciclo, duração máxima do vídeo, quantidade de telas, faixa de horário (horário nobre opcional) e período.
- Exemplo de planos (valores ilustrativos, a definir):

| Plano   | Inserções/ciclo | Duração máx. | Telas                          |
|---------|-----------------|--------------|--------------------------------|
| Básico  | 1               | 15 s         | 1                              |
| Padrão  | 2               | 30 s         | até 3                          |
| Premium | 4               | 30 s         | todas + prioridade horário nobre |

- **Controle de capacidade:** ao criar campanha, o sistema verifica espaços livres por tela no período e bloqueia telas lotadas.
- **Montagem da playlist:** inserções distribuídas de forma intercalada no ciclo, sem repetir o mesmo anúncio em sequência. Espaços livres recebem conteúdo institucional.
- **Relatório de exibições (proof of play):** cada exibição registrada pelo player; serve de comprovação de entrega ao anunciante.

### 2.4 Anúncios

- Upload de vídeo até **30 MB**, formato padrão **MP4 (H.264/AAC)**.
- Metadados: título, descrição, categoria.
- Status: rascunho, agendado, publicado, arquivado no Drive.

### 2.5 Telas

- Pareamento por código exibido no player.
- Orientação: `0` (paisagem), `90` (retrato), `180` (paisagem invertida), `270` (retrato invertido). O player aplica a rotação.
- Status online/offline via heartbeat: **Online**, **Sem sinal** (mais de 2 min sem heartbeat), **Offline**.

---

## 3. Stack

| Camada | Tecnologia |
|---|---|
| Painel + API | Next.js (App Router), TypeScript |
| UI | Tailwind CSS, shadcn/ui, TanStack Table, react-hook-form + Zod, dnd-kit, lucide |
| Banco de dados | PostgreSQL |
| ORM / migrations | Drizzle (TypeScript é o dono do schema) |
| Player | PWA em TypeScript, Service Worker + Cache API/OPFS |
| Worker | Python (gerenciado com `uv`), SQLAlchemy/psycopg, ffprobe/ffmpeg, google-api-python-client |
| Fila de jobs | Tabela `jobs` no PostgreSQL com `SELECT ... FOR UPDATE SKIP LOCKED` (ou Procrastinate no lado Python) |
| Armazenamento local | MinIO (compatível com S3), cota de 1 GB |
| Nuvem / backup | Google Drive API (Shared Drive + OAuth Workspace ou service account) |
| Provisionamento de players | PowerShell (mini PCs Windows) |
| Infra | Docker / docker-compose; produção em VPS (a definir) |

### 3.1 Integração TypeScript ↔ Python

- **Banco:** migrations somente no Drizzle. O Python lê e escreve no mesmo banco, sem migrations próprias.
- **Contratos:** schemas Zod em `packages/shared` → exportados como JSON Schema → modelos Pydantic gerados com `datamodel-code-generator`.
- **Fila:** tabela `jobs` compartilhada no PostgreSQL.

---

## 4. Estrutura do monorepo

```
/
├── apps/
│   ├── web/              # Next.js: painel + API
│   └── player/           # PWA do player
├── workers/
│   └── media/            # Worker Python (uv)
├── packages/
│   ├── database/         # Schema e migrations (Drizzle)
│   └── shared/           # Contratos Zod (manifesto, eventos)
├── scripts/
│   └── provision/        # PowerShell: setup do player em Windows
├── docs/
│   └── PROJECT_BRIEF.md  # Este documento
├── docker-compose.yml    # PostgreSQL, MinIO, app, worker
└── .env.example
```

Gerenciador: pnpm + Turborepo.

---

## 5. Protocolo do player

1. **Pareamento:** `POST /api/player/register` → retorna código curto + token do dispositivo. O admin digita o código no painel e vincula a uma tela.
2. **Manifesto:** `GET /api/player/manifest` com ETag (polling). JSON com versão, orientação e loop; cada item com `adId`, URL, `sha256`, duração e janelas de validade. O player baixa só o que falta, verifica o hash e troca a playlist de forma atômica. Offline, continua com o último manifesto válido.
3. **Comandos:** WebSocket ou SSE para ações imediatas (recarregar, pausar, forçar atualização, tela de emergência). Polling como fallback.
4. **Heartbeat:** `POST /api/player/heartbeat` a cada 30–60 s (item atual, uso do cache, versão do app). Atualiza `screens.last_seen_at`.
5. **Proof of play:** exibições registradas localmente e enviadas em lote.
6. **Orientação:** `transform: rotate()` no container, invertendo largura/altura em 90/270.

Modo adicional opcional: **Window Management API** do Chrome para abrir o player em um segundo monitor ligado ao mesmo computador.

---

## 6. Modelo de dados (inicial)

- `users`
- `advertisers`
- `categories`
- `ads` — título, descrição, categoria, `storage_key`, `drive_file_id`, tamanho, duração, codec, `sha256`, `storage_tier` (local | drive), status
- `screens` — nome, local, orientação (enum 0/90/180/270), `device_token`, `last_seen_at`, pareado em
- `plans` — inserções por ciclo, duração máxima, limite de telas, faixa de horário
- `campaigns` — anunciante, anúncio, plano, data de início, data de término, janelas de horário, dias da semana
- `campaign_screens` — N:N campanhas × telas
- `playlists` — loop materializado por tela, versionado (origem do manifesto)
- `audit_logs` — ator, ação, entidade, id, `before`/`after` (jsonb), timestamp; **somente inserção**
- `play_logs` — exibições registradas pelos players
- `jobs` — fila compartilhada TS/Python

---

## 7. Ciclo de vida do vídeo e armazenamento

1. Upload → validação de MIME e limite de 30 MB → `ffprobe` exige MP4 H.264/AAC (transcodificação opcional com `ffmpeg`).
2. Arquivo salvo no MinIO (cota local de 1 GB).
3. **Backup no Google Drive disparado imediatamente** após o upload.
4. **Cron diário:** remove do armazenamento local os arquivos com mais de 7 dias **que não estão em nenhuma campanha ativa**. O `drive_file_id` é mantido.
5. Se um vídeo arquivado for reagendado, o worker baixa de volta do Drive antes de publicar o manifesto.
6. **Players baixam sempre do servidor, nunca do Drive** (o Drive não é CDN e tem limites de download).

Drive: usar Shared Drive (service accounts não têm cota própria) e upload resumable.

---

## 8. Histórico (log de auditoria)

- Registrar: adicionado, editado, removido, publicado, arquivado, expirado, backup, mudança de status de tela.
- Cada registro: data e hora, **usuário** (ou "Sistema"), ação, entidade, detalhe, `before`/`after`.
- Gravado na camada de serviço, **na mesma transação** da operação.
- Filtros por ação, período e usuário; exportação CSV.

---

## 9. Frontend

### 9.1 Navegação (barra lateral agrupada)

- **Visão geral:** Dashboard
- **Operação:** Telas, Playlists, Agenda
- **Comercial:** Anunciantes, Campanhas, Planos
- **Biblioteca:** Anúncios, Categorias
- **Sistema:** Histórico, Armazenamento/Drive, Usuários

### 9.2 Princípios

- Uma ação principal por tela; ações secundárias em menus.
- Status sempre com cor **e** texto (acessibilidade).
- Criação de campanha em assistente de etapas com resumo lateral e capacidade livre por tela.
- Biblioteca em grade com miniatura, duração, categoria e status; upload com arrastar e soltar, progresso e prévia.
- Playlists com arrastar e soltar; agenda em calendário/linha do tempo.
- Detalhe da tela com prévia da orientação.
- Player sem interface: fundo preto + vídeo; apenas a tela de pareamento com código grande.

### 9.3 Linguagem visual (provisória, até definir a identidade)

- Base neutra quente, barra lateral escura, uma cor de destaque (padrão `#4338CA`).
- Tipografia: Space Grotesk (títulos), IBM Plex Sans (texto), IBM Plex Mono (dados técnicos: horários, códigos, tamanhos).
- Grade de espaçamento de 8 px; modo escuro opcional.

### 9.4 Referência visual

https://claude.ai/artifact/CLKTk2hZM5L9JuBy4M7SaN — Dashboard, Biblioteca, Telas, Nova campanha, Histórico, Player (pareamento) e componente da barra lateral.

---

## 10. Roadmap

### Fase 0 — Definições
- [x] Nome da plataforma: Aembi Play
- [ ] Identidade visual (logo, cores, tipografia)
- [ ] Regras finais dos planos e tamanho do ciclo
- [ ] Hardware das telas (TV box Android ou mini PC)
- [ ] Perfis de acesso (só administradores ou também anunciantes)

### Fase 1 — Núcleo
- [ ] Monorepo (pnpm/Turborepo) + docker-compose (PostgreSQL, MinIO)
- [ ] Schema e migrations
- [ ] Upload com validação
- [ ] Cadastro de telas com pareamento e orientação
- [ ] Player: pareamento, manifesto, cache offline, reprodução
- [ ] Heartbeat + status no painel
- [ ] Teste real com 1–2 telas por algumas semanas

### Fase 2 — Comercial
- [ ] Anunciantes, planos, campanhas com validade
- [ ] Geração automática de playlist + controle de capacidade
- [ ] Log de auditoria

### Fase 3 — Automação e nuvem
- [ ] Agendamento avançado por faixa horária
- [ ] Backup e arquivamento no Google Drive
- [ ] Relatório de exibições
- [ ] Controles remotos das telas
- [ ] Script PowerShell de provisionamento

### Produção (depois)
- [ ] Deploy em VPS com Docker
- [ ] Domínio, HTTPS, backups do banco, monitoramento

---

## 11. Convenções do repositório

- Repositório **privado**.
- `.env.example` versionado; `.env` no `.gitignore`. **Credenciais nunca vão para o repositório.**
- `main` protegida; trabalho em branches por funcionalidade (`feat/`, `fix/`, `chore/`) com merge via pull request.
- Commits no padrão Conventional Commits.
- Milestones no GitHub por fase; uma issue por item do roadmap.
- CI com GitHub Actions: lint, checagem de tipos e testes em cada pull request.
- Tudo roda em Docker desde o início, para o ambiente local ser igual ao de produção.

---

## 12. Decisões em aberto

- Logo, cores e tipografia definitivos (nome definido: Aembi Play)
- Preços e regras finais dos planos; tamanho do ciclo
- Hardware padrão das telas
- Portal do anunciante (acesso próprio a relatórios) — sim ou não
- Provedor da VPS de produção
- Conta Google Workspace para o Drive
