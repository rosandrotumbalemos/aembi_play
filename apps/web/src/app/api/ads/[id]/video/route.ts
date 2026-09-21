import { db } from "@/lib/db";
import { getAdObject } from "@/lib/storage";
import { ads } from "@aembi-play/database";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

/**
 * GET /api/ads/[id]/video — proxy autenticado do vídeo original no MinIO.
 * Usado tanto pelo preview dentro do painel quanto pelo player (item.url do
 * manifesto — seção 5), que baixa e cacheia via Cache API a partir de outra
 * origem: precisa de CORS, senão o fetch cross-origin é rejeitado.
 * Repassa `Range` pra permitir avançar/voltar no `<video>` sem baixar o
 * arquivo inteiro de novo.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const [ad] = await db
    .select({ storageKey: ads.storageKey })
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);

  if (!ad?.storageKey) {
    return withCors(new NextResponse(null, { status: 404 }));
  }

  const range = request.headers.get("range") ?? undefined;

  try {
    const object = await getAdObject(ad.storageKey, range);
    const body = object.Body?.transformToWebStream();
    if (!body) {
      return withCors(new NextResponse(null, { status: 404 }));
    }

    const headers: Record<string, string> = {
      "Content-Type": object.ContentType ?? "video/mp4",
      "Accept-Ranges": "bytes",
      // Diferente da miniatura, o vídeo pode ser substituído (mesmo id,
      // outro anúncio republicado) — sem "immutable".
      "Cache-Control": "private, max-age=3600",
    };
    if (typeof object.ContentLength === "number") {
      headers["Content-Length"] = String(object.ContentLength);
    }

    if (range && object.ContentRange) {
      headers["Content-Range"] = object.ContentRange;
      return withCors(new NextResponse(body, { status: 206, headers }));
    }

    return withCors(new NextResponse(body, { status: 200, headers }));
  } catch {
    return withCors(new NextResponse(null, { status: 404 }));
  }
}
