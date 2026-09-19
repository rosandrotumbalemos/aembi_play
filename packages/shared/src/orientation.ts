import { z } from "zod";

/**
 * Orientação da tela — ver PROJECT_BRIEF.md seção 2.5 / 5.6.
 * O player aplica `transform: rotate()` no container, invertendo
 * largura/altura em 90/270.
 */
export const OrientationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export type Orientation = z.infer<typeof OrientationSchema>;
