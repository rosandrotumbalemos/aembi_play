import "./style.css";
import { getStoredDeviceToken, registerDevice } from "./device";
import { fetchManifest, isCacheApiAvailable, syncMediaCache } from "./manifest";
import { startHeartbeatLoop } from "./heartbeat";
import { applyOrientation } from "./orientation";
import { config } from "./config";
import type { PlayerManifest } from "@aembi-play/shared";

const app = document.querySelector<HTMLDivElement>("#app")!;

let manifest: PlayerManifest | null = null;
let currentAdId: string | null = null;

async function bootstrap(): Promise<void> {
  let deviceToken = getStoredDeviceToken();

  if (!deviceToken) {
    const registration = await renderPairingScreen();
    deviceToken = registration.deviceToken;
  }

  startHeartbeatLoop(
    deviceToken,
    () => currentAdId,
    () => manifest,
  );

  await refreshManifestLoop(deviceToken);
}

/** Tela de pareamento — apenas o código, grande e centralizado (seção 9.2). */
async function renderPairingScreen() {
  app.innerHTML = `
    <div id="pairing-screen">
      <div class="label">Digite este código no painel Aembi Play</div>
      <div class="code">····</div>
    </div>
  `;

  const registration = await registerDevice();
  const codeEl = app.querySelector(".code");
  if (codeEl) codeEl.textContent = registration.pairingCode;

  return registration;
}

/** Reconstrói o player (fundo preto + vídeo em loop) a partir do manifesto. */
function renderPlayer(): { video: HTMLVideoElement } {
  app.innerHTML = `
    <div id="rotation-container">
      <video id="player-video" autoplay muted playsinline></video>
    </div>
  `;

  return {
    video: app.querySelector<HTMLVideoElement>("#player-video")!,
  };
}

async function refreshManifestLoop(deviceToken: string): Promise<void> {
  const poll = async () => {
    const next = await fetchManifest(deviceToken);
    if (next) {
      const changed = next.version !== manifest?.version;
      manifest = next;
      if (changed) {
        await syncMediaCache(manifest);
        startPlaylist(manifest);
      }
    }
  };

  await poll();
  setInterval(() => void poll(), config.manifestPollIntervalMs);
}

function startPlaylist(manifest: PlayerManifest): void {
  const { video } = renderPlayer();
  const container = document.querySelector<HTMLElement>(
    "#rotation-container",
  )!;
  applyOrientation(container, manifest.orientation);

  let index = 0;

  const playNext = async () => {
    if (manifest.items.length === 0) return;

    const item = manifest.items[index % manifest.items.length];
    currentAdId = item.adId;

    video.src = item.url;
    if (isCacheApiAvailable()) {
      const cache = await caches.open(config.mediaCacheName);
      const cached = await cache.match(item.url);
      if (cached) {
        video.src = URL.createObjectURL(await cached.blob());
      }
    }

    index += 1;
  };

  video.addEventListener("ended", () => void playNext());
  void playNext();
}

void bootstrap();
