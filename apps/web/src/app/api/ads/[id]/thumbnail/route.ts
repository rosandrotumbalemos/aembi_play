import { db } from "@/lib/db";
import { getAdObject } from "@/lib/storage";
import { ads } from "@aembi-play/database";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/ads/[id]/thumbnail — serve a miniatura gerada pelo worker
 * (ffmpeg) a partir do MinIO. Proxy autenticado pela sessão do painel em vez
 * de expor o bucket publicamente — mesma lógica de "servidor no meio" da
 * seção 7.6 do briefing.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const [ad] = await db
    .select({ thumbnailKey: ads.thumbnailKey })
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);

  if (!ad?.thumbnailKey) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const object = await getAdObject(ad.thumbnailKey);
    const body = await object.Body?.transformToByteArray();
    if (!body) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(Buffer.from(body), {
      headers: {
        "Content-Type": object.ContentType ?? "image/jpeg",
        // A chave inclui o id do anúncio e não é reaproveitada — pode
        // cachear "para sempre" no navegador.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
