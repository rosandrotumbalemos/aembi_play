import { CommandBatchSchema, PlayerCommandSchema, type PlayerCommand } from "@aembi-play/shared";
import { config } from "./config";

/** Handlers chamados pelo player em reação a um comando remoto (seção 5.3). */
export interface PlayerCommandHandlers {
  onReload: () => void;
  onPause: () => void;
  /** Despausa E sai do modo de emergência, se estiver ativo — ver main.ts. */
  onResume: () => void;
  onForceUpdate: () => void;
  /**
   * "emergency_screen" chega reafirmado a cada tick/poll enquanto ativo
   * (não é um evento de borda) — o handler precisa ser idempotente (ver
   * main.ts, que não re-renderiza se a mensagem não mudou).
   */
  onEmergencyState: (message: string | undefined) => void;
  onUnpair: () => void;
}

function dispatchOne(command: PlayerCommand, handlers: PlayerCommandHandlers): void {
  switch (command.type) {
    case "reload":
      handlers.onReload();
      break;
    case "pause":
      handlers.onPause();
      break;
    case "resume":
      handlers.onResume();
      break;
    case "force_update":
      handlers.onForceUpdate();
      break;
    case "emergency_screen":
      handlers.onEmergencyState(command.message);
      break;
    case "unpair":
      handlers.onUnpair();
      break;
  }
}

async function pollCommands(deviceToken: string, handlers: PlayerCommandHandlers): Promise<void> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/player/commands`, {
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    if (!res.ok) return;

    const parsed = CommandBatchSchema.safeParse(await res.json());
    if (!parsed.success) return;

    for (const command of parsed.data.commands) dispatchOne(command, handlers);
  } catch (err) {
    console.warn("[commands] falha ao consultar comandos (polling)", err);
  }
}

// Se o SSE nunca conseguir abrir dentro desse tempo, assume que o canal
// está bloqueado (proxy, navegador antigo sem EventSource etc.) e cai pro
// polling — que é o fallback exigido pelo briefing (seção 5.3). Uma vez
// aberto, deixa o próprio EventSource cuidar de reconectar sozinho em
// quedas transitórias, sem alternar pra polling à toa.
const SSE_CONNECT_TIMEOUT_MS = 8_000;

/**
 * Abre o canal SSE de comandos com fallback automático pra polling.
 * EventSource não permite header Authorization customizado, então o
 * deviceToken viaja como query string só nesta rota.
 */
export function startCommandLoop(deviceToken: string, handlers: PlayerCommandHandlers): () => void {
  let stopped = false;
  let es: EventSource | null = null;
  let connectTimeout: number | undefined;
  let pollTimer: number | undefined;
  let hasConnectedOnce = false;

  const startPolling = () => {
    if (pollTimer !== undefined) return;
    void pollCommands(deviceToken, handlers);
    pollTimer = window.setInterval(() => void pollCommands(deviceToken, handlers), config.commandPollIntervalMs);
  };

  const stopPolling = () => {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };

  const trySse = () => {
    const url = `${config.apiBaseUrl}/api/player/commands/stream?token=${encodeURIComponent(deviceToken)}`;

    try {
      es = new EventSource(url);
    } catch {
      startPolling();
      return;
    }

    connectTimeout = window.setTimeout(() => {
      if (stopped || hasConnectedOnce) return;
      es?.close();
      es = null;
      startPolling();
    }, SSE_CONNECT_TIMEOUT_MS);

    es.addEventListener("open", () => {
      hasConnectedOnce = true;
      if (connectTimeout !== undefined) {
        window.clearTimeout(connectTimeout);
        connectTimeout = undefined;
      }
      stopPolling();
    });

    es.addEventListener("command", (event) => {
      try {
        const data: unknown = JSON.parse((event as MessageEvent<string>).data);
        const parsed = PlayerCommandSchema.safeParse(data);
        if (parsed.success) dispatchOne(parsed.data, handlers);
      } catch {
        // mensagem malformada — ignora, o próximo tick corrige sozinho.
      }
    });

    es.addEventListener("error", () => {
      // Ainda não conectou nenhuma vez: deixa o timeout acima decidir se
      // cai pro polling. Já tinha conectado antes: é uma queda
      // transitória, o EventSource reconecta sozinho — nada a fazer aqui.
    });
  };

  if (typeof EventSource !== "undefined") {
    trySse();
  } else {
    startPolling();
  }

  return () => {
    stopped = true;
    if (connectTimeout !== undefined) window.clearTimeout(connectTimeout);
    es?.close();
    stopPolling();
  };
}
