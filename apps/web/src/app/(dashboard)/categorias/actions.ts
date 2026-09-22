"use server";

import { db } from "@/lib/db";
import { categories } from "@aembi-play/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

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
    await db.transaction(async (tx) => {
      const [category] = await tx.insert(categories).values({ name }).returning({ id: categories.id });
      await logAudit(tx, {
        action: "adicionado",
        entity: "categories",
        entityId: category.id,
        detail: `Categoria "${name}" cadastrada.`,
        after: { name },
      });
    });
  } catch {
    return { error: "Já existe uma categoria com esse nome." };
  }

  revalidatePath("/categorias");
  revalidatePath("/anuncios");
  return { success: true };
}

/** Remove uma categoria; anúncios que a usavam ficam sem categoria (ON DELETE SET NULL). */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [category] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, id)).limit(1);
    await tx.delete(categories).where(eq(categories.id, id));
    await logAudit(tx, {
      action: "removido",
      entity: "categories",
      entityId: id,
      detail: category ? `Categoria "${category.name}" removida.` : "Categoria removida.",
      before: category ?? null,
    });
  });

  revalidatePath("/categorias");
  revalidatePath("/anuncios");
}
