import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ads, campaignScreens, campaigns, jobs, plans, playlists } from "@aembi-play/database";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

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
 * Faixa de horário (campaigns.timeWindowStart/End) e dias da semana
 * (campaigns.daysOfWeek) não restringem a geração em si — a campanha segue
 * elegível pelo intervalo de datas (startDate/endDate) o tempo todo — mas
 * são carregados em cada item da playlist (campaignId/validFrom/validUntil/
 * dailyWindowStart/End/daysOfWeek) para o manifesto repassar ao player, que
 * é quem de fato decide, a cada instante, quais itens do loop pode exibir
 * agora (seção 2.4, Fase 3: agendamento avançado).
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
      adStorageTier: ads.storageTier,
      insertionsPerCycle: plans.insertionsPerCycle,
      maxDurationSeconds: plans.maxDurationSeconds,
      campaignId: campaigns.id,
      campaignStartDate: campaigns.startDate,
      campaignEndDate: campaigns.endDate,
      timeWindowStart: campaigns.timeWindowStart,
      timeWindowEnd: campaigns.timeWindowEnd,
      daysOfWeek: campaigns.daysOfWeek,
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

  // Anúncio arquivado (seção 7.4/7.5) sendo reagendado — dispara a
  // restauração do Drive pro worker Python buscar de volta antes de o
  // player efetivamente precisar baixar o vídeo. Best-effort/assíncrono:
  // a playlist ainda inclui o item agora (não trava a geração esperando o
  // worker), e a restauração normalmente termina bem antes do próximo
  // poll de manifesto do player.
  const archivedAdIds = [...new Set(eligible.filter((row) => row.adStorageTier === "drive").map((row) => row.adId))];
  if (archivedAdIds.length > 0) {
    await enqueueRestoreForArchivedAds(archivedAdIds);
  }

  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  const queues = eligible.map((row) => ({
    adId: row.adId,
    durationSeconds: row.adDurationSeconds,
    remaining: row.insertionsPerCycle,
    campaignId: row.campaignId,
    validFrom: row.campaignStartDate.toISOString(),
    validUntil: row.campaignEndDate.toISOString(),
    dailyWindowStart: row.timeWindowStart ?? undefined,
    dailyWindowEnd: row.timeWindowEnd ?? undefined,
    daysOfWeek: row.daysOfWeek,
  }));

  const items: Array<{
    adId: string;
    durationSeconds: number;
    slotIndex: number;
    campaignId: string;
    validFrom: string;
    validUntil: string;
    dailyWindowStart?: string;
    dailyWindowEnd?: string;
    daysOfWeek: number[];
  }> = [];
  let slotIndex = 0;
  let anyRemaining = true;
  while (anyRemaining) {
    anyRemaining = false;
    for (const queue of queues) {
      if (queue.remaining > 0) {
        items.push({
          adId: queue.adId,
          durationSeconds: queue.durationSeconds,
          slotIndex: slotIndex++,
          campaignId: queue.campaignId,
          validFrom: queue.validFrom,
          validUntil: queue.validUntil,
          dailyWindowStart: queue.dailyWindowStart,
          dailyWindowEnd: queue.dailyWindowEnd,
          daysOfWeek: queue.daysOfWeek.length > 0 ? queue.daysOfWeek : ALL_DAYS,
        });
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

/**
 * Enfileira `restore_from_drive` (worker Python, seção 7.5) pra cada
 * anúncio arquivado ainda sem um job pendente — dedup pra não empilhar um
 * job por tela a cada regeneração de playlist enquanto o mesmo anúncio
 * ainda está sendo restaurado (a restauração troca `storage_tier` de volta
 * pra "local", o que já impede reenfileirar depois de concluído).
 */
async function enqueueRestoreForArchivedAds(adIds: string[]): Promise<void> {
  const pending = await db
    .select({ payload: jobs.payload })
    .from(jobs)
    .where(and(eq(jobs.type, "restore_from_drive"), inArray(jobs.status, ["pending", "processing"])));

  const alreadyQueued = new Set(
    pending
      .map((row) => (row.payload as { adId?: string }).adId)
      .filter((adId): adId is string => Boolean(adId)),
  );

  const toQueue = adIds.filter((adId) => !alreadyQueued.has(adId));
  if (toQueue.length === 0) return;

  await db.insert(jobs).values(
    toQueue.map((adId) => ({
      type: "restore_from_drive" as const,
      payload: { adId },
    })),
  );
}

/** Regenera a playlist de cada tela informada (dedup automático). */
export async function regeneratePlaylistsForScreens(screenIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(screenIds)];
  for (const screenId of uniqueIds) {
    await generatePlaylistForScreen(screenId);
  }
}
