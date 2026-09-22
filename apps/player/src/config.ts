// Em dev, o player costuma ser aberto de outro dispositivo na rede local
// (TV box, celular pra testar o pareamento) — nesse caso "localhost" não
// aponta pro PC que roda o painel. Sem VITE_API_BASE_URL definido, assume o
// painel no mesmo host que serviu o player (porta 3000).
const defaultApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://localhost:3000";

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl,
  manifestPollIntervalMs: Number(
    import.meta.env.VITE_MANIFEST_POLL_INTERVAL_MS ?? 30_000,
  ),
  heartbeatIntervalMs: Number(
    import.meta.env.VITE_HEARTBEAT_INTERVAL_MS ?? 45_000,
  ),
  // Quando nenhum item do manifesto está elegível agora (fora da faixa de
  // horário/dia da semana de todas as campanhas, ver main.ts), o player
  // fica em tela ociosa e tenta de novo nesse intervalo — não precisa ser
  // curto, já que a granularidade útil é de minutos (faixas em "HH:MM").
  idleRecheckIntervalMs: Number(
    import.meta.env.VITE_IDLE_RECHECK_INTERVAL_MS ?? 15_000,
  ),
  // Proof of play (seção 5.5) é registrado localmente e enviado em lote —
  // não precisa ser tão frequente quanto o heartbeat, já que o painel só
  // usa isso pra relatório, não pra status em tempo real.
  playLogFlushIntervalMs: Number(
    import.meta.env.VITE_PLAY_LOG_FLUSH_INTERVAL_MS ?? 60_000,
  ),
  // Controles remotos (seção 5.3): canal principal é SSE
  // (/api/player/commands/stream); isto só é usado como fallback quando o
  // SSE não consegue conectar (proxy bloqueando streaming, TV box com
  // EventSource capenga etc.) — ver apps/player/src/commands.ts.
  commandPollIntervalMs: Number(
    import.meta.env.VITE_COMMAND_POLL_INTERVAL_MS ?? 15_000,
  ),
  deviceTokenStorageKey: "aembi-player:device-token",
  manifestCacheName: "aembi-player-manifest-v1",
  mediaCacheName: "aembi-player-media-v1",
} as const;
