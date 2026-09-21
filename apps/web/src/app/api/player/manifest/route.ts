import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ads, playlists, screens } from "@aembi-play/database";
import { eq, desc, inArray } from "drizzle-orm";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

/**
 * GET /api/player/manifest — com ETag (polling), seção 5.2.
 * Retorna o manifesto (versão, orientação, loop e itens) para a tela
 * autenticada. 304 quando o If-None-Match bate com a versão atual.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const deviceToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!deviceToken) {
    return withCors(NextResponse.json({ error: "Token de dispositivo ausente" }, { status: 401 }));
  }

  const [screen] = await db
    .select()
    .from(screens)
    .where(eq(screens.deviceToken, deviceToken))
    .limit(1);

  if (!screen) {
    return withCors(NextResponse.json({ error: "Dispositivo não encontrado" }, { status: 404 }));
  }

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(eq(playlists.screenId, screen.id))
    .orderBy(desc(playlists.generatedAt))
    .limit(1);

  if (!playlist) {
    // Sem playlist gerada ainda — o player deve manter o último manifesto em cache.
    return withCors(
      NextResponse.json({ error: "Nenhuma playlist disponível para esta tela" }, { status: 404 }),
    );
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === playlist.version) {
    return withCors(new NextResponse(null, { status: 304 }));
  }

  // TODO (Fase 2): validFrom/validUntil devem vir da janela da campanha
  // (seção 2.4) — sem campanhas ainda, cada item vale a partir de agora por
  // um horizonte bem largo, só pra satisfazer o contrato do manifesto.
  const adIds = playlist.items
    .map((item) => item.adId)
    .filter((adId): adId is string => adId !== null);

  const adRows =
    adIds.length > 0
      ? await db.select({ id: ads.id, sha256: ads.sha256 }).from(ads).where(inArray(ads.id, adIds))
      : [];
  const adById = new Map(adRows.map((row) => [row.id, row]));

  // `request.url` pode não refletir o host real usado pelo cliente (proxy,
  // ou o player acessando o painel por outro IP na rede — não é sempre
  // localhost, ver apps/player/src/config.ts). O cabeçalho Host é o que o
  // player efetivamente discou, então é a base confiável pra montar a URL
  // do vídeo que ele mesmo vai buscar depois.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");
  const origin = host
    ? `${forwardedProto ?? "http"}://${host}`
    : new URL(request.url).origin;
  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);

  const items = playlist.items.flatMap((item) => {
    if (item.adId === null) return [];
    const ad = adById.get(item.adId);
    if (!ad) return []; // anúncio removido/despublicado desde que a playlist foi salva
    return [
      {
        adId: item.adId,
        url: `${origin}/api/ads/${item.adId}/video`,
        sha256: ad.sha256,
        durationSeconds: item.durationSeconds,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      },
    ];
  });

  const manifest = {
    version: playlist.version,
    screenId: screen.id,
    orientation: Number(screen.orientation) as 0 | 90 | 180 | 270,
    loopDurationSeconds: playlist.loopDurationSeconds,
    items,
    generatedAt: playlist.generatedAt.toISOString(),
  };

  return withCors(
    NextResponse.json(manifest, {
      headers: { ETag: playlist.version },
    }),
  );
}
