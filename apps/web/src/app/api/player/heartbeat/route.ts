import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screens } from "@aembi-play/database";
import { HeartbeatPayloadSchema } from "@aembi-play/shared";
import { eq } from "drizzle-orm";

/**
 * POST /api/player/heartbeat — a cada 30–60s (seção 5.4).
 * Atualiza screens.last_seen_at, usado para status online/sem sinal/offline.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const deviceToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!deviceToken) {
    return NextResponse.json({ error: "Token de dispositivo ausente" }, { status: 401 });
  }

  const parsed = HeartbeatPayloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(screens)
    .set({ lastSeenAt: new Date() })
    .where(eq(screens.deviceToken, deviceToken))
    .returning({ id: screens.id });

  if (!updated) {
    return NextResponse.json({ error: "Dispositivo não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
