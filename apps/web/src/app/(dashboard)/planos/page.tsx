import { Badge } from "@/components/ui/badge";
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
import { plans } from "@aembi-play/database";
import { desc } from "drizzle-orm";
import { NewPlanDialog } from "./new-plan-dialog";

async function getPlans() {
  try {
    const rows = await db.select().from(plans).orderBy(desc(plans.createdAt));
    return { rows, dbAvailable: true };
  } catch {
    return { rows: [], dbAvailable: false };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest}s`;
}

export default async function PlanosPage() {
  const { rows, dbAvailable } = await getPlans();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            Planos
          </h1>
          <p className="text-sm text-muted-foreground">
            Inserções por ciclo, duração máxima, limite de telas e faixa de horário nobre.
          </p>
        </div>
        <NewPlanDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planos cadastrados</CardTitle>
          <CardDescription>
            {dbAvailable
              ? "Cada campanha referencia um plano — ele define quanto espaço ela ocupa no loop de cada tela."
              : "Banco de dados não conectado — rode as migrations para ver dados reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Inserções/ciclo</TableHead>
                <TableHead>Duração máx.</TableHead>
                <TableHead>Limite de telas</TableHead>
                <TableHead>Faixa nobre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum plano cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.insertionsPerCycle}x</TableCell>
                    <TableCell>{formatDuration(plan.maxDurationSeconds)}</TableCell>
                    <TableCell>{plan.maxScreens}</TableCell>
                    <TableCell>
                      {plan.primeTimeAccess ? (
                        <Badge>
                          {plan.timeWindowStart && plan.timeWindowEnd
                            ? `${plan.timeWindowStart}–${plan.timeWindowEnd}`
                            : "Sim"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
