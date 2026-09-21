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
  deviceTokenStorageKey: "aembi-player:device-token",
  manifestCacheName: "aembi-player-manifest-v1",
  mediaCacheName: "aembi-player-media-v1",
} as const;
