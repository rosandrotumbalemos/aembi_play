import { z } from "zod";
import { OrientationSchema } from "./orientation";

/**
 * Item da playlist dentro do manifesto do player.
 * Ver PROJECT_BRIEF.md seção 5.2.
 */
export const ManifestItemSchema = z.object({
  adId: z.string().uuid(),
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 inválido"),
  durationSeconds: z.number().positive(),
  /** Janela de validade do item (ver seção 2.4). */
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  /**
   * Agendamento fino (Fase 3, seção 2.2/2.4/10): faixa de horário diária
   * ("HH:MM", ambos presentes ou ambos ausentes) e dias da semana em que o
   * item pode ser exibido (0=domingo .. 6=sábado). Ausentes = sem restrição
   * além de validFrom/validUntil (ex.: itens de playlist manual, sem
   * campanha por trás).
   */
  dailyWindowStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  dailyWindowEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

export type ManifestItem = z.infer<typeof ManifestItemSchema>;

/**
 * Manifesto retornado por GET /api/player/manifest (polling com ETag).
 * O player baixa só o que falta, verifica o hash de cada item e troca
 * a playlist de forma atômica. Offline, continua com o último manifesto
 * válido em cache.
 */
export const PlayerManifestSchema = z.object({
  /** Versão/etag do manifesto — usada para saber se algo mudou. */
  version: z.string(),
  screenId: z.string().uuid(),
  orientation: OrientationSchema,
  /** Duração total do ciclo/loop em segundos (referência: 300s = 5min). */
  loopDurationSeconds: z.number().positive().default(300),
  items: z.array(ManifestItemSchema),
  generatedAt: z.string().datetime(),
});

export type PlayerManifest = z.infer<typeof PlayerManifestSchema>;
