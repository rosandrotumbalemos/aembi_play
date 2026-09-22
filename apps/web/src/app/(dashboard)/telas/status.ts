// Limiares de status online/sem sinal/offline (seção 2.5) — compartilhado
// entre a listagem (page.tsx) e o diagnóstico de conexão sob demanda
// (connection-actions.ts), pra nunca divergir.
export const SEM_SINAL_MS = 2 * 60 * 1000; // "Sem sinal": mais de 2 min sem heartbeat

export type ScreenStatus = "online" | "sem_sinal" | "offline";

export function screenStatus(lastSeenAt: Date | null): ScreenStatus {
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - lastSeenAt.getTime();
  if (elapsed <= SEM_SINAL_MS) return "online";
  if (elapsed <= SEM_SINAL_MS * 5) return "sem_sinal";
  return "offline";
}

export const STATUS_LABEL: Record<ScreenStatus, string> = {
  online: "Online",
  sem_sinal: "Sem sinal",
  offline: "Offline",
};

export const STATUS_VARIANT: Record<ScreenStatus, "default" | "secondary" | "destructive"> = {
  online: "default",
  sem_sinal: "secondary",
  offline: "destructive",
};
