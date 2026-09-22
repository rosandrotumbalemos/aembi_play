import { db } from "@/lib/db";
import { screenCommands, screens } from "@aembi-play/database";
import type { PlayerCommand } from "@aembi-play/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

/**
 * Junta o que deve ser enviado agora pro player de uma tela (seção 5.3):
 *
 * 1. Comandos de um tiro pendentes na fila (reload/pause/resume/
 *    force_update/unpair) — cada um marcado como entregue assim que sai
 *    daqui, pra não ser reenviado (mas fica pendente pra sempre até
 *    alguém de fato consultar, então uma tela offline não perde nada).
 * 2. Modo de emergência, se ativo — não vem da fila, vem direto de
 *    screens.emergency_mode/emergency_message: precisa ser reafirmado
 *    toda vez que o player conecta ou consulta (SSE a cada tick, polling
 *    a cada request), senão uma tela que reconecta depois de perder o
 *    evento original nunca saberia que ainda está em emergência. O lado
 *    do player trata isso como idempotente (ver apps/player/src/main.ts).
 *
 * Chamada tanto pela rota SSE quanto pela rota de polling — nunca deve
 * divergir entre as duas.
 */
export async function collectOutgoingCommands(screenId: string): Promise<PlayerCommand[]> {
  const pending = await db
    .select({ id: screenCommands.id, type: screenCommands.type })
    .from(screenCommands)
    .where(and(eq(screenCommands.screenId, screenId), isNull(screenCommands.deliveredAt)))
    .orderBy(asc(screenCommands.createdAt));

  const out: PlayerCommand[] = pending.map((row) => ({ type: row.type }) as PlayerCommand);

  if (pending.length > 0) {
    await db
      .update(screenCommands)
      .set({ deliveredAt: new Date() })
      .where(
        inArray(
          screenCommands.id,
          pending.map((row) => row.id),
        ),
      );
  }

  const [screen] = await db
    .select({ emergencyMode: screens.emergencyMode, emergencyMessage: screens.emergencyMessage })
    .from(screens)
    .where(eq(screens.id, screenId))
    .limit(1);

  if (screen?.emergencyMode) {
    out.push({ type: "emergency_screen", message: screen.emergencyMessage ?? undefined });
  }

  return out;
}

/** Resolve a tela autenticada a partir do Bearer deviceToken. */
export async function resolveScreenByToken(deviceToken: string): Promise<{ id: string } | null> {
  const [screen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(eq(screens.deviceToken, deviceToken))
    .limit(1);

  return screen ?? null;
}
