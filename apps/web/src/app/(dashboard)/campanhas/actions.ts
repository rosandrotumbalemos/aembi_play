"use server";

import { db } from "@/lib/db";
import { ads, campaignScreens, campaigns, plans } from "@aembi-play/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { regeneratePlaylistsForScreens } from "@/lib/playlist-generator";
import { logAudit } from "@/lib/audit";

export type CampaignFormState = { error?: string; success?: boolean };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type CreateCampaignInput = {
  advertiserId: string;
  adId: string;
  planId: string;
  screenIds: string[];
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  timeWindowStart: string; // "" quando não usado
  timeWindowEnd: string;
};

/**
 * Cria uma campanha (seção 2.1/2.2) — vincula anunciante + anúncio + plano a
 * um conjunto de telas, com validade (start/end) e faixa de horário diária
 * opcional (dias da semana ficam no padrão "todos", ver campaigns.daysOfWeek
 * — agendamento fino por dia é Fase 3). A geração automática de playlist
 * (próxima etapa) lê as campanhas ativas de cada tela pra montar o loop.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<CampaignFormState> {
  const {
    advertiserId,
    adId,
    planId,
    screenIds,
    startDate,
    endDate,
    timeWindowStart,
    timeWindowEnd,
  } = input;

  if (!advertiserId) return { error: "Selecione o anunciante." };
  if (!adId) return { error: "Selecione o anúncio." };
  if (!planId) return { error: "Selecione o plano." };
  if (screenIds.length === 0) return { error: "Selecione ao menos uma tela." };
  if (!startDate || !endDate) return { error: "Informe as datas de início e fim." };

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:59:59Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Datas inválidas." };
  }
  if (start > end) {
    return { error: "A data de início deve ser antes (ou igual) à data de fim." };
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

  const [ad] = await db
    .select({
      id: ads.id,
      advertiserId: ads.advertiserId,
      status: ads.status,
      durationSeconds: ads.durationSeconds,
    })
    .from(ads)
    .where(eq(ads.id, adId))
    .limit(1);

  if (!ad || ad.advertiserId !== advertiserId) {
    return { error: "O anúncio selecionado não pertence a esse anunciante." };
  }
  if (ad.status !== "publicado") {
    return { error: "Só é possível criar campanha com um anúncio publicado." };
  }

  const [plan] = await db
    .select({ id: plans.id, name: plans.name, maxScreens: plans.maxScreens, maxDurationSeconds: plans.maxDurationSeconds })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) return { error: "Plano não encontrado." };
  if (screenIds.length > plan.maxScreens) {
    return {
      error: `O plano selecionado permite no máximo ${plan.maxScreens} tela(s) — você selecionou ${screenIds.length}.`,
    };
  }
  if (ad.durationSeconds > plan.maxDurationSeconds) {
    return {
      error: `A duração do anúncio (${ad.durationSeconds}s) excede o máximo do plano "${plan.name}" (${plan.maxDurationSeconds}s).`,
    };
  }

  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        advertiserId,
        adId,
        planId,
        startDate: start,
        endDate: end,
        timeWindowStart: timeWindowStart || null,
        timeWindowEnd: timeWindowEnd || null,
      })
      .returning({ id: campaigns.id });

    await tx.insert(campaignScreens).values(
      screenIds.map((screenId) => ({ campaignId: campaign.id, screenId })),
    );

    await logAudit(tx, {
      action: "adicionado",
      entity: "campaigns",
      entityId: campaign.id,
      detail: `Campanha criada (${screenIds.length} tela(s), plano "${plan.name}").`,
      after: { advertiserId, adId, planId, screenIds, startDate, endDate, timeWindowStart, timeWindowEnd },
    });
  });

  // Refaz a playlist das telas afetadas já com essa campanha (seção 2.3) —
  // se nenhuma campanha elegível existir pra alguma delas, a geração é um
  // no-op e a playlist manual/anterior continua valendo (ver
  // playlist-generator.ts).
  await regeneratePlaylistsForScreens(screenIds);

  revalidatePath("/campanhas");
  revalidatePath("/telas");
  return { success: true };
}

/** Ativa/desativa uma campanha sem apagar o histórico. */
export async function setCampaignActive(id: string, active: boolean): Promise<void> {
  const affectedScreens = await db
    .select({ screenId: campaignScreens.screenId })
    .from(campaignScreens)
    .where(eq(campaignScreens.campaignId, id));

  await db.transaction(async (tx) => {
    await tx.update(campaigns).set({ active }).where(eq(campaigns.id, id));

    await logAudit(tx, {
      action: "editado",
      entity: "campaigns",
      entityId: id,
      detail: active ? "Campanha reativada." : "Campanha pausada.",
      after: { active },
    });
  });

  // Pausar tira a campanha do cálculo; reativar pode trazê-la de volta —
  // nos dois casos a playlist da tela precisa refletir o conjunto atual de
  // campanhas ativas.
  await regeneratePlaylistsForScreens(affectedScreens.map((row) => row.screenId));

  revalidatePath("/campanhas");
  revalidatePath("/telas");
}
