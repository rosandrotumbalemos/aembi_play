"use server";

import { db } from "@/lib/db";
import { screens } from "@aembi-play/database";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generatePlaylistForScreen } from "@/lib/playlist-generator";
import { logAudit } from "@/lib/audit";

const ORIENTATIONS = ["0", "90", "180", "270"] as const;
type OrientationValue = (typeof ORIENTATIONS)[number];

function parseOrientation(value: FormDataEntryValue | null): OrientationValue {
  const str = String(value ?? "0");
  return (ORIENTATIONS as readonly string[]).includes(str) ? (str as OrientationValue) : "0";
}

export type ScreenFormState = { error?: string; success?: boolean };

/**
 * Vincula uma tela ainda não pareada (criada por POST /api/player/register)
 * a partir do código de 6 dígitos exibido na tela do player — seção 2.5 / 5.1.
 */
export async function pairScreen(
  _prevState: ScreenFormState,
  formData: FormData,
): Promise<ScreenFormState> {
  const pairingCode = String(formData.get("pairingCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const orientation = parseOrientation(formData.get("orientation"));

  if (!pairingCode || !name) {
    return { error: "Preencha o código de pareamento e o nome da tela." };
  }

  const [screen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(
      and(
        eq(screens.pairingCode, pairingCode),
        isNull(screens.pairedAt),
        gt(screens.pairingCodeExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!screen) {
    return {
      error: "Código inválido ou expirado. Peça para o player gerar um novo código.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(screens)
      .set({
        name,
        location: location || null,
        orientation,
        pairedAt: new Date(),
        pairingCode: null,
        pairingCodeExpiresAt: null,
      })
      .where(eq(screens.id, screen.id));

    await logAudit(tx, {
      action: "mudanca_status_tela",
      entity: "screens",
      entityId: screen.id,
      detail: `Tela "${name}" pareada.`,
      after: { name, location: location || null, orientation, status: "pareada" },
    });
  });

  revalidatePath("/telas");
  revalidatePath("/");
  return { success: true };
}

/** Edita nome, local e orientação de uma tela já pareada. */
export async function updateScreen(
  _prevState: ScreenFormState,
  formData: FormData,
): Promise<ScreenFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const orientation = parseOrientation(formData.get("orientation"));

  if (!id || !name) {
    return { error: "O nome da tela é obrigatório." };
  }

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ name: screens.name, location: screens.location, orientation: screens.orientation })
      .from(screens)
      .where(eq(screens.id, id))
      .limit(1);

    await tx
      .update(screens)
      .set({ name, location: location || null, orientation })
      .where(eq(screens.id, id));

    await logAudit(tx, {
      action: "editado",
      entity: "screens",
      entityId: id,
      detail: `Tela "${name}" editada.`,
      before: before ?? null,
      after: { name, location: location || null, orientation },
    });
  });

  revalidatePath("/telas");
  return { success: true };
}

/**
 * Despareia a tela (seção 2.2): revoga o device_token, forçando o player a
 * se registrar de novo (novo código) na próxima vez que carregar.
 */
export async function unpairScreen(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [screen] = await tx.select({ name: screens.name }).from(screens).where(eq(screens.id, id)).limit(1);

    await tx
      .update(screens)
      .set({ deviceToken: null, pairedAt: null, lastSeenAt: null })
      .where(eq(screens.id, id));

    await logAudit(tx, {
      action: "mudanca_status_tela",
      entity: "screens",
      entityId: id,
      detail: screen ? `Tela "${screen.name}" despareada.` : "Tela despareada.",
      after: { status: "despareada" },
    });
  });

  revalidatePath("/telas");
  revalidatePath("/");
}

export type RegeneratePlaylistState = { message: string; generated: boolean };

/**
 * Botão "Gerar playlist automaticamente" em Telas — cobre o caso em que
 * nada mudou em Campanhas (criar/pausar/reativar já refazem a playlist na
 * hora), mas o tempo passou e uma campanha entrou ou saiu da validade
 * (start/end date) sozinha. Sem agendador ainda (Fase 3), isso é
 * manual por enquanto.
 */
export async function regenerateScreenPlaylist(screenId: string): Promise<RegeneratePlaylistState> {
  const result = await generatePlaylistForScreen(screenId);
  revalidatePath("/telas");

  if (!result.generated) {
    return {
      generated: false,
      message: "Nenhuma campanha ativa e dentro da validade para essa tela — playlist mantida como está.",
    };
  }

  return {
    generated: true,
    message: `Playlist gerada com ${result.itemCount} inserção(ões), ${result.loopDurationSeconds}s de loop.`,
  };
}
