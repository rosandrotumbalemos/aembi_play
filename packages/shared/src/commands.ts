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
