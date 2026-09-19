export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
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
