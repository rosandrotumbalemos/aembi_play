import type { PlayerManifest } from "@aembi-play/shared";
import { config } from "./config";

const APP_VERSION = "0.1.0";

/**
 * POST /api/player/heartbeat a cada 30–60s (seção 5.4).
 * Envia item atual, uso do cache e versão do app; atualiza
 * screens.last_seen_at no painel.
 */
export async function sendHeartbeat(
  deviceToken: string,
  currentAdId: string | null,
  manifest: PlayerManifest | null,
): Promise<void> {
  const cacheUsageBytes = await estimateCacheUsage();

  try {
    await fetch(`${config.apiBaseUrl}/api/player/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        deviceToken,
        currentAdId,
        cacheUsageBytes,
        appVersion: APP_VERSION,
        manifestVersion: manifest?.version ?? "unknown",
      }),
    });
  } catch (err) {
    console.warn("[heartbeat] falha ao enviar (provável offline)", err);
  }
}

async function estimateCacheUsage(): Promise<number> {
  if (!navigator.storage?.estimate) return 0;
  const { usage } = await navigator.storage.estimate();
  return usage ?? 0;
}

export function startHeartbeatLoop(
  deviceToken: string,
  getCurrentAdId: () => string | null,
  getManifest: () => PlayerManifest | null,
): () => void {
  const interval = setInterval(() => {
    void sendHeartbeat(deviceToken, getCurrentAdId(), getManifest());
  }, config.heartbeatIntervalMs);

  return () => clearInterval(interval);
}
