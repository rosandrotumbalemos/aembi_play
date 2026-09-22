import { PlayLogEntrySchema, type PlayLogEntry } from "@aembi-play/shared";
import { config } from "./config";

const QUEUE_KEY = "aembi-player:play-log-queue";
// Evita crescimento sem limite se o player ficar muito tempo offline —
// descarta as entradas mais antigas antes disso (não há como enviá-las de
// qualquer forma sem rede, e melhor perder umas poucas do passado distante
// do que travar o localStorage).
const MAX_QUEUE_SIZE = 500;

function readQueue(): PlayLogEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlayLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: PlayLogEntry[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage cheio ou indisponível — proof of play é best-effort,
    // não deve travar a reprodução.
  }
}

/**
 * Registra uma exibição localmente (seção 5.5 — proof of play). Chamado
 * pelo player quando um item realmente começa a tocar (evento `playing` do
 * `<video>`, ver main.ts), não apenas quando é atribuído ao elemento — só
 * queremos provar o que de fato reproduziu, não o que foi só solicitado.
 */
export function recordPlay(entry: PlayLogEntry): void {
  const parsed = PlayLogEntrySchema.safeParse(entry);
  if (!parsed.success) return;

  const queue = readQueue();
  queue.push(parsed.data);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  writeQueue(queue);
}

/**
 * Envia o lote pendente pro painel; só remove da fila local o que foi
 * confirmado (2xx) — offline ou erro, tudo continua guardado pra próxima
 * tentativa. Novas entradas registradas durante o envio (recordPlay
 * enquanto o fetch está em voo) ficam depois das enviadas no array, já que
 * é o único ponto que grava na fila — por isso um "slice" a partir do
 * tamanho do lote enviado basta pra descartar exatamente as confirmadas.
 */
export async function flushPlayLogs(deviceToken: string): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  try {
    const res = await fetch(`${config.apiBaseUrl}/api/player/play-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({ deviceToken, entries: queue }),
    });
    if (res.ok) {
      writeQueue(readQueue().slice(queue.length));
    }
  } catch (err) {
    console.warn("[play-log] falha ao enviar lote (provável offline)", err);
  }
}

export function startPlayLogFlushLoop(deviceToken: string): () => void {
  const interval = setInterval(() => void flushPlayLogs(deviceToken), config.playLogFlushIntervalMs);
  return () => clearInterval(interval);
}
