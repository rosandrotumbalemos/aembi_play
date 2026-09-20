"use server";

import { db } from "@/lib/db";
import { screens } from "@aembi-play/database";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

  await db
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

  await db
    .update(screens)
    .set({ name, location: location || null, orientation })
    .where(eq(screens.id, id));

  revalidatePath("/telas");
  return { success: true };
}

/**
 * Despareia a tela (seção 2.2): revoga o device_token, forçando o player a
 * se registrar de novo (novo código) na próxima vez que carregar.
 */
export async function unpairScreen(id: string): Promise<void> {
  await db
    .update(screens)
    .set({ deviceToken: null, pairedAt: null, lastSeenAt: null })
    .where(eq(screens.id, id));

  revalidatePath("/telas");
  revalidatePath("/");
}
