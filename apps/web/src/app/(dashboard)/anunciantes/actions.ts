"use server";

import { db } from "@/lib/db";
import { advertisers } from "@aembi-play/database";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export type AdvertiserFormState = { error?: string; success?: boolean };

/** Cadastro de anunciante (seção 2.1 — primeiro passo do fluxo de campanha). */
export async function createAdvertiser(
  _prevState: AdvertiserFormState,
  formData: FormData,
): Promise<AdvertiserFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const document = String(formData.get("document") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    return { error: "O nome do anunciante é obrigatório." };
  }

  await db.transaction(async (tx) => {
    const [advertiser] = await tx
      .insert(advertisers)
      .values({
        name,
        document: document || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      })
      .returning({ id: advertisers.id });

    await logAudit(tx, {
      action: "adicionado",
      entity: "advertisers",
      entityId: advertiser.id,
      detail: `Anunciante "${name}" cadastrado.`,
      after: { name, document, email, phone },
    });
  });

  revalidatePath("/anunciantes");
  revalidatePath("/anuncios");
  return { success: true };
}
