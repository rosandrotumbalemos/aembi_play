import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { advertisers } from "@aembi-play/database";
import { desc } from "drizzle-orm";
import { NewAdvertiserDialog } from "./new-advertiser-dialog";

async function getAdvertisers() {
  try {
    const rows = await db.select().from(advertisers).orderBy(desc(advertisers.createdAt));
    return { rows, dbAvailable: true };
  } catch {
    return { rows: [], dbAvailable: false };
  }
}

export default async function AnunciantesPage() {
  const { rows, dbAvailable } = await getAdvertisers();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            Anunciantes
          </h1>
          <p className="text-sm text-muted-foreground">
            Quem contrata espaço nas telas — primeiro passo do cadastro de campanha.
          </p>
        </div>
        <NewAdvertiserDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anunciantes cadastrados</CardTitle>
          <CardDescription>
            {dbAvailable
              ? "Necessário cadastrar um anunciante antes de subir anúncios dele na Biblioteca."
              : "Banco de dados não conectado — rode as migrations para ver dados reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum anunciante cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((advertiser) => (
                  <TableRow key={advertiser.id}>
                    <TableCell className="font-medium">{advertiser.name}</TableCell>
                    <TableCell>{advertiser.document ?? "—"}</TableCell>
                    <TableCell>{advertiser.email ?? "—"}</TableCell>
                    <TableCell>{advertiser.phone ?? "—"}</TableCell>
                    <TableCell>
                      {new Date(advertiser.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
