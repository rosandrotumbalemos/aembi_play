import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screens } from "@aembi-play/database";
import { generateDeviceToken, generatePairingCode, PAIRING_CODE_TTL_MS } from "@/lib/pairing";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

/**
 * POST /api/player/register — PROJECT_BRIEF.md seção 5.1.
 * Cria uma tela ainda não vinculada, com código curto de pareamento e um
 * token de dispositivo. O admin digita o código no painel (rota de
 * pareamento, a implementar em /telas) para vincular a uma tela.
 */
export async function POST() {
  const pairingCode = generatePairingCode();
  const deviceToken = generateDeviceToken();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

  const [screen] = await db
    .insert(screens)
    .values({
      name: "Nova tela",
      deviceToken,
      pairingCode,
      pairingCodeExpiresAt: expiresAt,
    })
    .returning({ id: screens.id });

  return withCors(
    NextResponse.json({
      pairingCode,
      deviceToken,
      expiresAt: expiresAt.toISOString(),
      screenId: screen?.id,
    }),
  );
}
