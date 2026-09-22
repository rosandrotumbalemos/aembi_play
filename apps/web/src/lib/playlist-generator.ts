import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ads, campaignScreens, campaigns, plans, playlists } from "@aembi-play/database";
import { and, eq, gte, lte } from "drizzle-orm";

export type GeneratePlaylistResult =
  | { generated: true; itemCount: number; loopDurationSeconds: number }
  | { generated: false; reason: "no_eligible_campaigns" };

/**
 * Geração automática de playlist (seção 2.3, Fase 2 — Comercial). Junta as
 * campanhas ativas e dentro da validade dessa tela, com o anúncio ainda
 * publicado e dentro da duração máxima do plano, e monta o loop
 * intercalando as inserções de cada campanha (round-robin) em vez de
 * agrupar tudo de uma campanha seguido — é o "controle de capacidade":
 * cada campanha ocupa `plan.insertionsPerCycle` espaços do loop, na
 * proporção do plano contratado, nunca mais que isso.
 *
 * Faixa de horário (campaigns.timeWindowStart/End) e dias da semana não são
 * aplicados aqui — o player toca o loop continuamente, sem noção de
 * horário do dia; agendamento fino por faixa é Fase 3 do roadmap.
 *
 * Não escreve nada quando não há campanha elegível: a tela mantém a
 * playlist manual (ou a última gerada) em vez de ficar em branco — troca
 * de volta pro modo manual é feita atribuindo a playlist de novo em Telas.
 */
export async function generatePlaylistForScreen(screenId: string): Promise<GeneratePlaylistResult> {
  const now = new Date();

  const rows = await db
    .select({
      adId: ads.id,
      adDurationSeconds: ads.durationSeconds,
      adStatus: ads.status,
      insertionsPerCycle: plans.insertionsPerCycle,
      maxDurationSeconds: plans.maxDurationSeconds,
    })
    .from(campaignScreens)
    .innerJoin(campaigns, eq(campaignScreens.campaignId, campaigns.id))
    .innerJoin(ads, eq(campaigns.adId, ads.id))
    .innerJoin(plans, eq(campaigns.planId, plans.id))
    .where(
      and(
        eq(campaignScreens.screenId, screenId),
        eq(campaigns.active, true),
        lte(campaigns.startDate, now),
        gte(campaigns.endDate, now),
      ),
    );

  const eligible = rows.filter(
    (row) => row.adStatus === "publicado" && row.adDurationSeconds <= row.maxDurationSeconds,
  );

  if (eligible.length === 0) {
    return { generated: false, reason: "no_eligible_campaigns" };
  }

  const queues = eligible.map((row) => ({
    adId: row.adId,
    durationSeconds: row.adDurationSeconds,
    remaining: row.insertionsPerCycle,
  }));

  const items: Array<{ adId: string; durationSeconds: number; slotIndex: number }> = [];
  let slotIndex = 0;
  let anyRemaining = true;
  while (anyRemaining) {
    anyRemaining = false;
    for (const queue of queues) {
      if (queue.remaining > 0) {
        items.push({ adId: queue.adId, durationSeconds: queue.durationSeconds, slotIndex: slotIndex++ });
        queue.remaining -= 1;
        if (queue.remaining > 0) anyRemaining = true;
      }
    }
  }

  const loopDurationSeconds = items.reduce((sum, item) => sum + item.durationSeconds, 0);

  await db.insert(playlists).values({
    screenId,
    version: randomUUID(),
    loopDurationSeconds,
    items,
  });

  return { generated: true, itemCount: items.length, loopDurationSeconds };
}

/** Regenera a playlist de cada tela informada (dedup automático). */
export async function regeneratePlaylistsForScreens(screenIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(screenIds)];
  for (const screenId of uniqueIds) {
    await generatePlaylistForScreen(screenId);
  }
}
