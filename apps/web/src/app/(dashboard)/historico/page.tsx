import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { auditLogs } from "@aembi-play/database";
import { desc, sql } from "drizzle-orm";
import type { AuditAction, AuditEntity } from "@/lib/audit";
import { AUDIT_ACTION_BADGE_VARIANT, AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "./labels";
import { HistoricoFilters } from "./filters";
import { buildHistoricoWhere, parseHistoricoFilters, type HistoricoSearchParams } from "./query";

const PAGE_SIZE = 50;

async function getPageData(searchParams: HistoricoSearchParams) {
  const filters = parseHistoricoFilters(searchParams);
  const where = buildHistoricoWhere(filters);
  const page = Math.max(1, Number(searchParams.page) || 1);

  try {
    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    ]);

    return { filters, page, rows, total: count, dbAvailable: true as const };
  } catch {
    return { filters, page, rows: [], total: 0, dbAvailable: false as const };
  }
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPageHref(searchParams: HistoricoSearchParams, page: number) {
  const params = new URLSearchParams();
  if (searchParams.action) params.set("action", searchParams.action);
  if (searchParams.entity) params.set("entity", searchParams.entity);
  if (searchParams.actor) params.set("actor", searchParams.actor);
  if (searchParams.from) params.set("from", searchParams.from);
  if (searchParams.to) params.set("to", searchParams.to);
  params.set("page", String(page));
  return `/historico?${params.toString()}`;
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<HistoricoSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { filters, page, rows, total, dbAvailable } = await getPageData(resolvedSearchParams);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Histórico
        </h1>
        <p className="text-sm text-muted-foreground">
          Log de auditoria — toda alteração feita a partir do painel fica registrada aqui,
          gravada na mesma transação da operação (seção 8 do briefing).
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <HistoricoFilters defaultValues={filters} />

          {!dbAvailable ? (
            <p className="text-sm text-muted-foreground">
              Não foi possível conectar ao banco de dados.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum registro encontrado{filters.action || filters.entity || filters.actor || filters.from || filters.to ? " para esses filtros." : "."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={AUDIT_ACTION_BADGE_VARIANT[row.action as AuditAction]}>
                          {AUDIT_ACTION_LABELS[row.action as AuditAction]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {AUDIT_ENTITY_LABELS[row.entity as AuditEntity] ?? row.entity}
                      </TableCell>
                      <TableCell>{row.actorLabel}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {row.detail ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {total} registro{total === 1 ? "" : "s"} — página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={buildPageHref(resolvedSearchParams, page - 1)}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Anterior
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={buildPageHref(resolvedSearchParams, page + 1)}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Próxima
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
