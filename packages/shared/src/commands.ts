import { z } from "zod";

/**
 * Comandos enviados via WebSocket/SSE (fallback: polling) para ações
 * imediatas no player — ver PROJECT_BRIEF.md seção 5.3.
 */
export const PlayerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reload") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("force_update") }),
  z.object({
    type: z.literal("emergency_screen"),
    message: z.string().optional(),
  }),
  z.object({ type: z.literal("unpair") }),
]);

export type PlayerCommand = z.infer<typeof PlayerCommandSchema>;

/**
 * Os comandos de um tiro que realmente passam pela fila
 * (packages/database screen_commands) — "emergency_screen" fica de fora
 * porque é estado durável (screens.emergency_mode), não fila. Espelha
 * commandTypeEnum em packages/database/src/schema.ts.
 */
export type CommandTypeMinusEmergency = Exclude<PlayerCommand["type"], "emergency_screen">;

/** Resposta de GET /api/player/commands — fallback de polling (seção 5.3). */
export const CommandBatchSchema = z.object({
  commands: z.array(PlayerCommandSchema),
});

export type CommandBatch = z.infer<typeof CommandBatchSchema>;
