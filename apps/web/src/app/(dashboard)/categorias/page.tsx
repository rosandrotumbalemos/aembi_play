import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { categories } from "@aembi-play/database";
import { desc } from "drizzle-orm";
import { DeleteCategoryButton } from "./delete-category-button";
import { NewCategoryForm } from "./new-category-form";

async function getCategories() {
  try {
    const rows = await db.select().from(categories).orderBy(desc(categories.createdAt));
    return { rows, dbAvailable: true };
  } catch {
    return { rows: [], dbAvailable: false };
  }
}

export default async function CategoriasPage() {
  const { rows, dbAvailable } = await getCategories();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Categorias
        </h1>
        <p className="text-sm text-muted-foreground">
          Organizam os anúncios na Biblioteca — opcional na hora do upload.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova categoria</CardTitle>
          <CardDescription>
            {dbAvailable
              ? "Cadastre categorias como “Institucional”, “Promoção” etc."
              : "Banco de dados não conectado — rode as migrations para ver dados reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewCategoryForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rows.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-1 rounded-full border pl-3 pr-1 py-1"
                >
                  <Badge variant="outline" className="border-none px-0 text-sm font-normal">
                    {category.name}
                  </Badge>
                  <DeleteCategoryButton id={category.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
