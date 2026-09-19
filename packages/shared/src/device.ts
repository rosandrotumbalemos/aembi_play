import { z } from "zod";

/**
 * POST /api/player/register — pareamento inicial (seção 5.1).
 * O player exibe `pairingCode` em tela grande; o admin digita esse
 * código no painel e vincula o dispositivo a uma tela.
 */
export const RegisterDeviceResponseSchema = z.object({
  pairingCode: z.string().min(4),
  deviceToken: z.string(),
  expiresAt: z.string().datetime(),
});

export type RegisterDeviceResponse = z.infer<
  typeof RegisterDeviceResponseSchema
>;

/**
 * POST /api/player/heartbeat — a cada 30–60s (seção 5.4).
 * Atualiza screens.last_seen_at no painel.
 */
export const HeartbeatPayloadSchema = z.object({
  deviceToken: z.string(),
  currentAdId: z.string().uuid().nullable(),
  cacheUsageBytes: z.number().nonnegative(),
  appVersion: z.string(),
  manifestVersion: z.string(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

/** Status de conectividade da tela — ver seção 2.5. */
export const ScreenStatusSchema = z.enum(["online", "sem_sinal", "offline"]);
export type ScreenStatus = z.infer<typeof ScreenStatusSchema>;
