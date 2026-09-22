import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ads, playLogs, screens } from "@aembi-play/database";
import { PlayLogBatchSchema } from "@aembi-play/shared";
import { eq, inArray } from "drizzle-orm";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

// Limite por requisição — o player já limita o tamanho da fila local
// (ver apps/player/src/play-log.ts), isto é só uma segunda trava contra um
// lote absurdo (bug no cliente ou token reaproveitado indevidamente).
const MAX_BATCH_SIZE = 500;

/**
 * POST /api/player/play-logs — proof of play em lote (seção 2.3/5.5).
 * O player registra cada exibição localmente e envia periodicamente; só
 * remove da fila local depois de um 2xx daqui — então esta rota sempre
 * responde 2xx quando o dispositivo é válido, mesmo descartando entradas
 * inválidas internamente (reter um lote ruim pra sempre na fila do player
 * não ajudaria, já que ele não sabe corrigi-las).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const deviceToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!deviceToken) {
    return withCors(NextResponse.json({ error: "Token de dispositivo ausente" }, { status: 401 }));
  }

  const parsed = PlayLogBatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return withCors(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }));
  }

  const [screen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(eq(screens.deviceToken, deviceToken))
    .limit(1);

  if (!screen) {
    return withCors(NextResponse.json({ error: "Dispositivo não encontrado" }, { status: 404 }));
  }

  // screenId vem em cada entrada do payload (o player só sabe o próprio id
  // via o manifesto — não há como omitir no schema já definido em
  // packages/shared/src/play-log.ts), mas quem autentica é o deviceToken:
  // nunca confiamos no screenId do corpo pra decidir onde gravar. Um token
  // comprometido não deveria conseguir registrar exibição pra outra tela.
  const ownEntries = parsed.data.entries
    .filter((entry) => entry.screenId === screen.id)
    .slice(0, MAX_BATCH_SIZE);

  if (ownEntries.length === 0) {
    return withCors(NextResponse.json({ inserted: 0 }));
  }

  // ad_id tem FK pra ads (onDelete cascade) — um anúncio removido depois de
  // já ter sido exibido não deveria quebrar o lote inteiro; descarta só as
  // entradas órfãs e segue com o resto.
  const adIds = [...new Set(ownEntries.map((entry) => entry.adId))];
  const existingAds = await db.select({ id: ads.id }).from(ads).where(inArray(ads.id, adIds));
  const existingAdIds = new Set(existingAds.map((row) => row.id));

  const rows = ownEntries
    .filter((entry) => existingAdIds.has(entry.adId))
    .map((entry) => ({
      screenId: screen.id,
      adId: entry.adId,
      playedAt: new Date(entry.playedAt),
      durationSeconds: Math.round(entry.durationSeconds),
      manifestVersion: entry.manifestVersion,
    }));

  if (rows.length > 0) {
    await db.insert(playLogs).values(rows);
  }

  return withCors(NextResponse.json({ inserted: rows.length }));
}
