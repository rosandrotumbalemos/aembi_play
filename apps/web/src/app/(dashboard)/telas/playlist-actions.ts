"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ads, playlists } from "@aembi-play/database";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type PlaylistFormState = { error?: string; success?: boolean };

/**
 * Define (substitui) a playlist de uma tela — MVP simples enquanto a
 * Fase 2 (campanhas, capacidade de ciclo, seção 2.3) não existe: sem
 * agendamento por horário, só a ordem de reprodução escolhida no painel.
 * `adIds` já vem na ordem desejada. Cada chamada grava uma nova versão
 * (histórico imutável — `playlists_screen_version_idx`); o manifesto do
 * player sempre lê a mais recente por tela.
 */
export async function setScreenPlaylist(
  screenId: string,
  adIds: string[],
): Promise<PlaylistFormState> {
  if (adIds.length === 0) {
    return { error: "Selecione ao menos um anúncio." };
  }

  const rows = await db
    .select({ id: ads.id, durationSeconds: ads.durationSeconds })
    .from(ads)
    .where(and(inArray(ads.id, adIds), eq(ads.status, "publicado")));

  const durationById = new Map(rows.map((row) => [row.id, row.durationSeconds]));
  const missing = adIds.filter((id) => !durationById.has(id));
  if (missing.length > 0) {
    return { error: "Um ou mais anúncios selecionados não estão publicados." };
  }

  const items = adIds.map((adId, index) => ({
    adId,
    durationSeconds: durationById.get(adId)!,
    slotIndex: index,
  }));
  const loopDurationSeconds = items.reduce((sum, item) => sum + item.durationSeconds, 0);

  await db.insert(playlists).values({
    screenId,
    version: randomUUID(),
    loopDurationSeconds,
    items,
  });

  revalidatePath("/telas");
  revalidatePath("/playlists");
  return { success: true };
}
