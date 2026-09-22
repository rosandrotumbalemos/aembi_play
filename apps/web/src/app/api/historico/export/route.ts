import { db } from "@/lib/db";
import { auditLogs } from "@aembi-play/database";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { AuditAction, AuditEntity } from "@/lib/audit";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/app/(dashboard)/historico/labels";
import { buildHistoricoWhere, parseHistoricoFilters } from "@/app/(dashboard)/historico/query";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * GET /api/historico/export — exportação CSV do log de auditoria (seção 8),
 * com os mesmos filtros (ação/entidade/usuário/período) da página, sem
 * paginação — traz tudo que casa com o filtro de uma vez.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = parseHistoricoFilters({
    action: url.searchParams.get("action") ?? undefined,
    entity: url.searchParams.get("entity") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const where = buildHistoricoWhere(filters);

  const rows = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt));

  const header = ["Data/hora", "Ação", "Entidade", "ID da entidade", "Usuário", "Detalhe"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.createdAt.toISOString(),
        AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action,
        AUDIT_ENTITY_LABELS[row.entity as AuditEntity] ?? row.entity,
        row.entityId,
        row.actorLabel,
        row.detail ?? "",
      ]
        .map((value) => csvEscape(String(value)))
        .join(","),
    );
  }
  // BOM no início — Excel só reconhece UTF-8 (acentuação em pt-BR) com isso.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historico-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
