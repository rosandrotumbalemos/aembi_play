import { RegisterDeviceResponseSchema } from "@aembi-play/shared";
import { config } from "./config";

/**
 * Pareamento (PROJECT_BRIEF.md seção 5.1).
 * POST /api/player/register → retorna código curto + token do dispositivo.
 * O token é persistido localmente; o código é exibido em tela até o admin
 * vincular o dispositivo a uma tela no painel.
 */
export function getStoredDeviceToken(): string | null {
  return localStorage.getItem(config.deviceTokenStorageKey);
}

export function storeDeviceToken(token: string): void {
  localStorage.setItem(config.deviceTokenStorageKey, token);
}

export async function registerDevice() {
  const res = await fetch(`${config.apiBaseUrl}/api/player/register`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Falha ao registrar dispositivo: ${res.status}`);
  }

  const data = RegisterDeviceResponseSchema.parse(await res.json());
  storeDeviceToken(data.deviceToken);
  return data;
}
