"use server";

import { db } from "@/lib/db";
import { screenCommands, screens } from "@aembi-play/database";
import type { CommandTypeMinusEmergency } from "@aembi-play/shared";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

/** Enfileira um comando de um tiro — entregue via SSE (fallback: polling). */
async function queueCommand(screenId: string, type: CommandTypeMinusEmergency): Promise<void> {
  await db.insert(screenCommands).values({ screenId, type });
}

export async function sendReload(screenId: string): Promise<void> {
  await queueCommand(screenId, "reload");
}

export async function sendPause(screenId: string): Promise<void> {
  await queueCommand(screenId, "pause");
}

/**
 * "Retomar" cobre os dois casos com um clique só: despausa (se pausada) E
 * sai do modo de emergência (se estiver ativo) — ver apps/player/src/main.ts,
 * onde o handler de "resume" faz as duas coisas.
 */
export async function sendResume(screenId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ emergencyMode: screens.emergencyMode })
      .from(screens)
      .where(eq(screens.id, screenId))
      .limit(1);

    if (before?.emergencyMode) {
      await tx
        .update(screens)
        .set({ emergencyMode: false, emergencyMessage: null })
        .where(eq(screens.id, screenId));

      await logAudit(tx, {
        action: "mudanca_status_tela",
        entity: "screens",
        entityId: screenId,
        detail: "Modo de emergência desativado.",
        after: { emergencyMode: false },
      });
    }

    await tx.insert(screenCommands).values({ screenId, type: "resume" });
  });

  revalidatePath("/telas");
}

export async function sendForceUpdate(screenId: string): Promise<void> {
  await queueCommand(screenId, "force_update");
}

/**
 * Modo de emergência (seção 5.3): estado durável em screens.emergency_mode,
 * não um comando de um tiro — ver apps/web/src/lib/commands.ts pra entender
 * por que precisa ser reafirmado a cada consulta do player.
 */
export async function enterEmergencyMode(screenId: string, message: string): Promise<void> {
  const trimmed = message.trim();

  await db.transaction(async (tx) => {
    const [screen] = await tx.select({ name: screens.name }).from(screens).where(eq(screens.id, screenId)).limit(1);

    await tx
      .update(screens)
      .set({ emergencyMode: true, emergencyMessage: trimmed || null })
      .where(eq(screens.id, screenId));

    await logAudit(tx, {
      action: "mudanca_status_tela",
      entity: "screens",
      entityId: screenId,
      detail: screen
        ? `Modo de emergência ativado em "${screen.name}"${trimmed ? `: "${trimmed}"` : ""}.`
        : "Modo de emergência ativado.",
      after: { emergencyMode: true, emergencyMessage: trimmed || null },
    });
  });

  revalidatePath("/telas");
}
