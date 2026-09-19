import { z } from "zod";

/**
 * Registro de exibição (proof of play) — seção 2.3 / 5.5.
 * Enviado em lote pelo player.
 */
export const PlayLogEntrySchema = z.object({
  screenId: z.string().uuid(),
  adId: z.string().uuid(),
  playedAt: z.string().datetime(),
  durationSeconds: z.number().positive(),
  manifestVersion: z.string(),
});

export type PlayLogEntry = z.infer<typeof PlayLogEntrySchema>;

export const PlayLogBatchSchema = z.object({
  deviceToken: z.string(),
  entries: z.array(PlayLogEntrySchema),
});

export type PlayLogBatch = z.infer<typeof PlayLogBatchSchema>;
