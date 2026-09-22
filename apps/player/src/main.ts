import "./style.css";
import { getStoredDeviceToken, registerDevice } from "./device";
import { fetchManifest, isCacheApiAvailable, syncMediaCache } from "./manifest";
import { startHeartbeatLoop } from "./heartbeat";
import { applyOrientation } from "./orientation";
import { config } from "./config";
import type { PlayerManifest } from "@aembi-play/shared";

type ManifestItem = PlayerManifest["items"][number];

const app = document.querySelector<HTMLDivElement>("#app")!;

let manifest: PlayerManifest | null = null;
let currentAdId: string | null = null;

// Timer de reconsulta da tela ociosa (ver showIdleScreen) — mora fora de
// startPlaylist porque um novo manifesto (troca de versão) chama
// startPlaylist de novo, e o timer da rodada anterior precisa ser
// cancelado, senão dois timers concorrentes ficam disputando a troca de
// tela ociosa → vídeo.
let idleRecheckTimer: number | undefined;

/**
 * Um item do manifesto só é exibido se: (1) agora está dentro de
 * validFrom/validUntil (validade da campanha, seção 2.4); (2) o dia da
 * semana atual está em daysOfWeek, quando informado; e (3) o horário atual
 * está dentro de dailyWindowStart–dailyWindowEnd, quando informado —
 * suportando faixas que cruzam a meia-noite (ex.: "22:00"–"06:00").
 * Itens sem esses campos (playlist manual, sem campanha por trás) só são
 * checados pela validade ampla que o manifesto sempre preenche.
 */
function isItemEligibleNow(item: ManifestItem, now: Date): boolean {
  const nowMs = now.getTime();
  if (nowMs < new Date(item.validFrom).getTime()) return false;
  if (nowMs > new Date(item.validUntil).getTime()) return false;

  if (item.daysOfWeek && item.daysOfWeek.length > 0 && !item.daysOfWeek.includes(now.getDay())) {
    return false;
  }

  if (item.dailyWindowStart && item.dailyWindowEnd) {
    const [startH, startM] = item.dailyWindowStart.split(":").map(Number);
    const [endH, endM] = item.dailyWindowEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const crossesMidnight = startMinutes > endMinutes;
    const withinWindow = crossesMidnight
      ? nowMinutes >= startMinutes || nowMinutes < endMinutes
      : nowMinutes >= startMinutes && nowMinutes < endMinutes;
    if (!withinWindow) return false;
  }

  return true;
}

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

/** Tela ociosa: nenhum item do manifesto está elegível agora (ver isItemEligibleNow). */
function renderIdleScreen(): void {
  app.innerHTML = `
    <div id="idle-screen">Nenhum conteúdo programado para este horário.</div>
  `;
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

/**
 * Toca o loop, pulando itens fora da janela de agendamento (ver
 * isItemEligibleNow). Quando nada está elegível agora, mostra a tela
 * ociosa e reconsulta periodicamente (config.idleRecheckIntervalMs) até
 * algum item entrar na janela — sem esperar o próximo poll de manifesto
 * (que pode levar até manifestPollIntervalMs).
 */
function startPlaylist(manifest: PlayerManifest): void {
  if (idleRecheckTimer !== undefined) {
    window.clearInterval(idleRecheckTimer);
    idleRecheckTimer = undefined;
  }

  let index = 0;
  let video: HTMLVideoElement | null = null;

  const enterIdle = () => {
    currentAdId = null;
    video = null;
    renderIdleScreen();
    if (idleRecheckTimer === undefined) {
      idleRecheckTimer = window.setInterval(() => void playNext(), config.idleRecheckIntervalMs);
    }
  };

  const ensureVideoElement = (): HTMLVideoElement => {
    if (!video) {
      const rendered = renderPlayer();
      video = rendered.video;
      const container = document.querySelector<HTMLElement>("#rotation-container")!;
      applyOrientation(container, manifest.orientation);
      video.addEventListener("ended", () => void playNext());
    }
    return video;
  };

  const playNext = async () => {
    if (manifest.items.length === 0) {
      enterIdle();
      return;
    }

    const now = new Date();
    let matchIndex = -1;
    for (let offset = 0; offset < manifest.items.length; offset++) {
      const candidateIndex = (index + offset) % manifest.items.length;
      if (isItemEligibleNow(manifest.items[candidateIndex], now)) {
        matchIndex = candidateIndex;
        break;
      }
    }

    if (matchIndex === -1) {
      enterIdle();
      return;
    }

    if (idleRecheckTimer !== undefined) {
      window.clearInterval(idleRecheckTimer);
      idleRecheckTimer = undefined;
    }

    const item = manifest.items[matchIndex];
    const el = ensureVideoElement();
    currentAdId = item.adId;
    index = (matchIndex + 1) % manifest.items.length;

    el.src = item.url;
    if (isCacheApiAvailable()) {
      const cache = await caches.open(config.mediaCacheName);
      const cached = await cache.match(item.url);
      if (cached) {
        el.src = URL.createObjectURL(await cached.blob());
      }
    }
  };

  void playNext();
}

void bootstrap();
