"use server";

import { db } from "@/lib/db";
import { categories } from "@aembi-play/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CategoryFormState = { error?: string; success?: boolean };

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "O nome da categoria é obrigatório." };
  }

  try {
    await db.insert(categories).values({ name });
  } catch {
    return { error: "Já existe uma categoria com esse nome." };
  }

  revalidatePath("/categorias");
  revalidatePath("/anuncios");
  return { success: true };
}

/** Remove uma categoria; anúncios que a usavam ficam sem categoria (ON DELETE SET NULL). */
export async function deleteCategory(id: string): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/categorias");
  revalidatePath("/anuncios");
}
