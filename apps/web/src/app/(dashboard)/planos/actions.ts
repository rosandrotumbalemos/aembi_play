"use server";

import { db } from "@/lib/db";
import { plans } from "@aembi-play/database";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export type PlanFormState = { error?: string; success?: boolean };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Cadastro de plano (seção 2.3) — inserções por ciclo, duração máxima por
 * inserção, limite de telas simultâneas e faixa de horário nobre opcional.
 * Consumido pelas Campanhas (cada campanha referencia um plano) e, na
 * geração automática de playlist, define quantos espaços do loop e qual
 * janela de horário cada campanha desse plano pode ocupar por tela.
 */
export async function createPlan(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const insertionsPerCycle = parsePositiveInt(formData.get("insertionsPerCycle"));
  const maxDurationSeconds = parsePositiveInt(formData.get("maxDurationSeconds"));
  const maxScreens = parsePositiveInt(formData.get("maxScreens"));
  const primeTimeAccess = formData.get("primeTimeAccess") === "on";
  const timeWindowStart = String(formData.get("timeWindowStart") ?? "").trim();
  const timeWindowEnd = String(formData.get("timeWindowEnd") ?? "").trim();

  if (!name) {
    return { error: "O nome do plano é obrigatório." };
  }
  if (!insertionsPerCycle) {
    return { error: "Inserções por ciclo deve ser um número inteiro maior que zero." };
  }
  if (!maxDurationSeconds) {
    return { error: "Duração máxima deve ser um número inteiro maior que zero (em segundos)." };
  }
  if (!maxScreens) {
    return { error: "Limite de telas deve ser um número inteiro maior que zero." };
  }
  if ((timeWindowStart && !timeWindowEnd) || (!timeWindowStart && timeWindowEnd)) {
    return { error: "Informe início e fim da faixa de horário, ou deixe os dois em branco." };
  }
  if (timeWindowStart && !TIME_PATTERN.test(timeWindowStart)) {
    return { error: "Horário de início inválido — use o formato HH:MM." };
  }
  if (timeWindowEnd && !TIME_PATTERN.test(timeWindowEnd)) {
    return { error: "Horário de fim inválido — use o formato HH:MM." };
  }

  await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(plans)
      .values({
        name,
        insertionsPerCycle,
        maxDurationSeconds,
        maxScreens,
        primeTimeAccess,
        timeWindowStart: timeWindowStart || null,
        timeWindowEnd: timeWindowEnd || null,
      })
      .returning({ id: plans.id });

    await logAudit(tx, {
      action: "adicionado",
      entity: "plans",
      entityId: plan.id,
      detail: `Plano "${name}" cadastrado.`,
      after: { name, insertionsPerCycle, maxDurationSeconds, maxScreens, primeTimeAccess },
    });
  });

  revalidatePath("/planos");
  revalidatePath("/campanhas");
  return { success: true };
}
