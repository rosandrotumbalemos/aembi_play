import { PlayerManifestSchema, type PlayerManifest } from "@aembi-play/shared";
import { config } from "./config";

const MANIFEST_ETAG_KEY = "aembi-player:manifest-etag";
const MANIFEST_CACHE_KEY = "aembi-player:manifest-json";

/**
 * GET /api/player/manifest com ETag (polling) — PROJECT_BRIEF.md seção 5.2.
 * Offline ou sem mudanças (304), continua com o último manifesto válido.
 */
export async function fetchManifest(
  deviceToken: string,
): Promise<PlayerManifest | null> {
  const etag = localStorage.getItem(MANIFEST_ETAG_KEY);

  try {
    const res = await fetch(`${config.apiBaseUrl}/api/player/manifest`, {
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        ...(etag ? { "If-None-Match": etag } : {}),
      },
    });

    if (res.status === 304) {
      return getCachedManifest();
    }

    if (!res.ok) {
      throw new Error(`Falha ao buscar manifesto: ${res.status}`);
    }

    const newEtag = res.headers.get("ETag");
    const manifest = PlayerManifestSchema.parse(await res.json());

    if (newEtag) localStorage.setItem(MANIFEST_ETAG_KEY, newEtag);
    localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest));

    return manifest;
  } catch (err) {
    console.warn("[manifest] offline ou erro de rede, usando cache", err);
    return getCachedManifest();
  }
}

function getCachedManifest(): PlayerManifest | null {
  const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
  if (!raw) return null;
  const parsed = PlayerManifestSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

/**
 * A Cache API exige contexto seguro (HTTPS, ou localhost) — em produção
 * (mini PC/TV box) isso é dado, mas em dev/teste (ex.: abrindo o player de
 * outro dispositivo por IP simples, via HTTP) `caches` nem existe no
 * `window`. Sem ela, o player toca direto da rede a cada item: perde o
 * cache offline, mas não trava.
 */
export function isCacheApiAvailable(): boolean {
  return typeof caches !== "undefined";
}

/**
 * Baixa apenas os itens que ainda não estão no cache local, verifica o
 * hash sha256 e mantém a troca de playlist atômica (só substitui a
 * playlist ativa depois que todos os itens novos foram validados).
 */
export async function syncMediaCache(
  manifest: PlayerManifest,
): Promise<void> {
  if (!isCacheApiAvailable()) {
    console.warn(
      "[media] Cache API indisponível (contexto não é seguro/HTTPS) — tocando direto da rede, sem cache offline",
    );
    return;
  }

  const cache = await caches.open(config.mediaCacheName);

  for (const item of manifest.items) {
    const cached = await cache.match(item.url);
    if (cached) continue;

    const res = await fetch(item.url);
    if (!res.ok) {
      console.error(`[media] falha ao baixar ${item.adId}`, res.status);
      continue;
    }

    const buffer = await res.clone().arrayBuffer();
    const hash = await sha256Hex(buffer);

    if (hash !== item.sha256.toLowerCase()) {
      console.error(`[media] hash inválido para ${item.adId}, descartando`);
      continue;
    }

    await cache.put(item.url, res);
  }

  await pruneStaleMedia(manifest);
}

async function pruneStaleMedia(manifest: PlayerManifest): Promise<void> {
  const cache = await caches.open(config.mediaCacheName);
  const keep = new Set(manifest.items.map((item) => item.url));
  const requests = await cache.keys();

  for (const request of requests) {
    if (!keep.has(request.url)) {
      await cache.delete(request);
    }
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
