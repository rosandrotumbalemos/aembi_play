import "./style.css";
import { getStoredDeviceToken, registerDevice } from "./device";
import { clearManifestCache, fetchManifest, isCacheApiAvailable, syncMediaCache } from "./manifest";
import { startHeartbeatLoop } from "./heartbeat";
import { recordPlay, startPlayLogFlushLoop } from "./play-log";
import { startCommandLoop, type PlayerCommandHandlers } from "./commands";
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

// Controles remotos (seção 5.3) — estado lido por playNext() (early return)
// e mexido pelos handlers de comando registrados em bootstrap(). "pause" e
// "emergency" são independentes: emergência sempre vence visualmente
// (renderiza por cima), mas os dois impedem o avanço automático da
// playlist enquanto ativos.
let isPaused = false;
let isEmergency = false;
let emergencyMessage: string | undefined;

// playNext "atual" — startPlaylist() é chamado de novo a cada troca de
// versão do manifesto, recriando o closure com um novo `playNext`; os
// handlers de comando (registrados uma vez só, em bootstrap) precisam
// sempre chamar a versão mais recente, não a de quando foram criados.
let currentPlayNext: (() => Promise<void>) | null = null;

// Reconsulta imediata do manifesto (comando "force_update"), sem esperar
// o próximo ciclo de config.manifestPollIntervalMs — ver refreshManifestLoop.
let forcePoll: (() => Promise<void>) | null = null;

// Mesma ideia de currentPlayNext: recriado a cada startPlaylist(). Preciso
// disto (em vez do handler de comando chamar renderEmergencyScreen direto)
// porque entrar em emergência troca o app.innerHTML por baixo do `video`
// que o closure de startPlaylist guarda — sem zerar essa referência aqui
// (como enterIdle já faz), ensureVideoElement() acha que o <video> ainda
// existe e nunca re-renderiza o player ao sair da emergência.
let currentEnterEmergency: ((message?: string) => void) | null = null;

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
  startPlayLogFlushLoop(deviceToken);
  startCommandLoop(deviceToken, buildCommandHandlers());

  await refreshManifestLoop(deviceToken);
}

/**
 * Handlers dos comandos remotos (seção 5.3) — registrados uma vez só, em
 * bootstrap(). Usam as referências mutáveis `currentPlayNext`/`forcePoll`
 * em vez de fechar sobre uma versão específica, porque startPlaylist() e
 * refreshManifestLoop() recriam seus closures internos a cada troca de
 * manifesto/versão.
 */
function buildCommandHandlers(): PlayerCommandHandlers {
  return {
    onReload: () => {
      window.location.reload();
    },
    onPause: () => {
      isPaused = true;
      document.querySelector<HTMLVideoElement>("#player-video")?.pause();
    },
    onResume: () => {
      const wasEmergency = isEmergency;
      isPaused = false;
      isEmergency = false;
      emergencyMessage = undefined;

      if (wasEmergency) {
        // Estava em emergência (sem vídeo montado) — reavalia do zero.
        void currentPlayNext?.();
        return;
      }

      const video = document.querySelector<HTMLVideoElement>("#player-video");
      if (video) {
        void video.play();
      } else {
        void currentPlayNext?.();
      }
    },
    onForceUpdate: () => {
      void forcePoll?.();
    },
    onEmergencyState: (message) => {
      // Reafirmado a cada tick/poll enquanto ativo (ver commands.ts) —
      // idempotente: só re-renderiza se de fato mudou algo.
      if (isEmergency && emergencyMessage === message) return;
      isPaused = false;
      isEmergency = true;
      emergencyMessage = message;
      if (currentEnterEmergency) {
        currentEnterEmergency(message);
      } else {
        // Antes do primeiro manifesto/startPlaylist (raríssimo — exigiria
        // emergência ativada antes do player nem ter pareado). isEmergency
        // já está true, então playNext() vai no-op assim que rodar.
        renderEmergencyScreen(message);
      }
    },
    onUnpair: () => {
      localStorage.removeItem(config.deviceTokenStorageKey);
      // Sem isto, um manifesto 404 (device_token novo, ainda não pareado)
      // cai no fallback "offline, usa cache" de fetchManifest() e volta a
      // mostrar o manifesto/vídeo da tela ANTERIOR — visto na prática
      // neste projeto.
      clearManifestCache();
      // reload() logo em seguida do removeItem() na mesma tarefa síncrona
      // corre risco de navegar antes da escrita no localStorage terminar
      // de persistir (visto na prática neste projeto) — o token "removido"
      // reaparecia depois do reload. Um setTimeout(0) empurra o reload pra
      // depois da escrita ser assentada.
      setTimeout(() => window.location.reload(), 0);
    },
  };
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

/**
 * Tela de emergência (seção 5.3): substitui a reprodução normal até um
 * comando "resume" chegar. A mensagem vem do painel (texto livre digitado
 * pelo operador) — escapada antes de entrar no innerHTML.
 */
function renderEmergencyScreen(message?: string): void {
  app.innerHTML = `
    <div id="emergency-screen">
      <div class="emergency-badge">Aviso</div>
      <div class="emergency-message">${escapeHtml(message?.trim() || "Conteúdo temporariamente indisponível.")}</div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
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

  // Comando remoto "force_update" (seção 5.3) chama isto pra reconsultar
  // na hora, sem esperar config.manifestPollIntervalMs.
  forcePoll = poll;

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

  /**
   * Chamado pelo handler de comando "emergency_screen" (ver
   * buildCommandHandlers, em main.ts) via currentEnterEmergency — zera
   * `video` (igual enterIdle) pra que ensureVideoElement() recrie o
   * elemento de vídeo do zero quando o "resume" sair da emergência, em vez
   * de reusar a referência de um <video> que app.innerHTML já descartou.
   */
  const enterEmergency = (message?: string) => {
    currentAdId = null;
    video = null;
    if (idleRecheckTimer !== undefined) {
      window.clearInterval(idleRecheckTimer);
      idleRecheckTimer = undefined;
    }
    renderEmergencyScreen(message);
  };
  currentEnterEmergency = enterEmergency;

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
    // Pausado ou em emergência (seção 5.3, comandos remotos): não avança a
    // playlist sozinho. Sai desses estados só via comando "resume", que
    // chama currentPlayNext() de volta explicitamente.
    if (isPaused || isEmergency) return;

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

    // Proof of play (seção 5.5): só registra quando o vídeo de fato começa
    // a reproduzir (evento `playing`, não a atribuição de `src` acima, que
    // pode falhar ao carregar) — listener de uma vez só, preso ao `src`
    // final já decidido (rede ou cache), pra não duplicar o registro caso a
    // troca pro blob em cache dispare `playing` de novo.
    const screenId = manifest.screenId;
    const manifestVersion = manifest.version;
    const adId = item.adId;
    const durationSeconds = item.durationSeconds;
    el.addEventListener(
      "playing",
      () => {
        recordPlay({
          screenId,
          adId,
          playedAt: new Date().toISOString(),
          durationSeconds,
          manifestVersion,
        });
      },
      { once: true },
    );
  };

  currentPlayNext = playNext;
  void playNext();
}

void bootstrap();
