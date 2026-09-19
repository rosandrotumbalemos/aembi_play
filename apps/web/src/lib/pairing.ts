import { randomBytes, randomInt } from "node:crypto";

/** Código curto exibido em tela cheia no player (seção 5.1 / 9.2). */
export function generatePairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Token de dispositivo — usado como Bearer nas chamadas subsequentes do player. */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos
