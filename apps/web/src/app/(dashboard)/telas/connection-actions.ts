"use server";

import { db } from "@/lib/db";
import { playlists, screens } from "@aembi-play/database";
import { desc, eq } from "drizzle-orm";
import { screenStatus, type ScreenStatus } from "./status";

export type ScreenConnectionSnapshot = {
  status: ScreenStatus;
  lastSeenAt: string | null;
  playlistVersion: string | null;
  playlistGeneratedAt: string | null;
  emergencyMode: boolean;
  emergencyMessage: string | null;
};

/**
 * Diagnóstico de conexão sob demanda ("Verificar conexão" no painel).
 *
 * A arquitetura é pull-only: o player é quem consulta o painel (heartbeat +
 * manifesto), nunca o contrário — não existe canal pra "ligar" uma aba
 * fechada do Safari a partir daqui (isso exigiria push real via Service
 * Worker/PWA, seção fora do escopo atual). O que este diagnóstico faz é
 * reconsultar `last_seen_at` no banco sob demanda, pra que o operador possa
 * reabrir o player no aparelho e ver o status virar "Online" aqui em tempo
 * quase real, em vez de confiar só no status estático carregado no load da
 * página.
 */
export async function getScreenConnectionSnapshot(
  screenId: string,
): Promise<ScreenConnectionSnapshot> {
  const [[screen], [playlist]] = await Promise.all([
    db
      .select({
        lastSeenAt: screens.lastSeenAt,
        emergencyMode: screens.emergencyMode,
        emergencyMessage: screens.emergencyMessage,
      })
      .from(screens)
      .where(eq(screens.id, screenId))
      .limit(1),
    db
      .select({ version: playlists.version, generatedAt: playlists.generatedAt })
      .from(playlists)
      .where(eq(playlists.screenId, screenId))
      .orderBy(desc(playlists.generatedAt))
      .limit(1),
  ]);

  return {
    status: screenStatus(screen?.lastSeenAt ?? null),
    lastSeenAt: screen?.lastSeenAt ? screen.lastSeenAt.toISOString() : null,
    playlistVersion: playlist?.version ?? null,
    playlistGeneratedAt: playlist?.generatedAt ? playlist.generatedAt.toISOString() : null,
    emergencyMode: screen?.emergencyMode ?? false,
    emergencyMessage: screen?.emergencyMessage ?? null,
  };
}
