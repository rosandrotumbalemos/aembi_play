import { NextRequest, NextResponse } from "next/server";
import { collectOutgoingCommands, resolveScreenByToken } from "@/lib/commands";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

/**
 * GET /api/player/commands — fallback de polling pros controles remotos
 * (seção 5.3). O player usa isto só quando o canal SSE
 * (/api/player/commands/stream) não conecta — proxy bloqueando streaming,
 * TV box com EventSource capenga, etc.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const deviceToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!deviceToken) {
    return withCors(NextResponse.json({ error: "Token de dispositivo ausente" }, { status: 401 }));
  }

  const screen = await resolveScreenByToken(deviceToken);
  if (!screen) {
    return withCors(NextResponse.json({ error: "Dispositivo não encontrado" }, { status: 404 }));
  }

  const commands = await collectOutgoingCommands(screen.id);
  return withCors(NextResponse.json({ commands }));
}
