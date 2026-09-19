import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { playlists, screens } from "@aembi-play/database";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/player/manifest — com ETag (polling), seção 5.2.
 * Retorna o manifesto (versão, orientação, loop e itens) para a tela
 * autenticada. 304 quando o If-None-Match bate com a versão atual.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const deviceToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!deviceToken) {
    return NextResponse.json({ error: "Token de dispositivo ausente" }, { status: 401 });
  }

  const [screen] = await db
    .select()
    .from(screens)
    .where(eq(screens.deviceToken, deviceToken))
    .limit(1);

  if (!screen) {
    return NextResponse.json({ error: "Dispositivo não encontrado" }, { status: 404 });
  }

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(eq(playlists.screenId, screen.id))
    .orderBy(desc(playlists.generatedAt))
    .limit(1);

  if (!playlist) {
    // Sem playlist gerada ainda — o player deve manter o último manifesto em cache.
    return NextResponse.json({ error: "Nenhuma playlist disponível para esta tela" }, {
      status: 404,
    });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === playlist.version) {
    return new NextResponse(null, { status: 304 });
  }

  // TODO (Fase 2): montar `items` a partir das campanhas ativas + capacidade
  // do ciclo (seção 2.3). Por ora, o manifesto reflete o campo `items` já
  // materializado na playlist.
  const manifest = {
    version: playlist.version,
    screenId: screen.id,
    orientation: Number(screen.orientation) as 0 | 90 | 180 | 270,
    loopDurationSeconds: playlist.loopDurationSeconds,
    items: [],
    generatedAt: playlist.generatedAt.toISOString(),
  };

  return NextResponse.json(manifest, {
    headers: { ETag: playlist.version },
  });
}
