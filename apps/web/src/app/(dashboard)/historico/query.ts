import { auditLogs } from "@aembi-play/database";
import { and, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { AUDIT_ENTITIES, type AuditAction, type AuditEntity } from "@/lib/audit";
import { AUDIT_ACTION_LABELS } from "./labels";

export type HistoricoSearchParams = {
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
};

export type HistoricoFilterValues = {
  action: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
};

const VALID_ACTIONS = new Set<string>(Object.keys(AUDIT_ACTION_LABELS));
const VALID_ENTITIES = new Set<string>(AUDIT_ENTITIES);

/** Normaliza e valida os query params — entradas desconhecidas viram "sem filtro". */
export function parseHistoricoFilters(searchParams: HistoricoSearchParams): HistoricoFilterValues {
  const action = searchParams.action && VALID_ACTIONS.has(searchParams.action) ? searchParams.action : "";
  const entity = searchParams.entity && VALID_ENTITIES.has(searchParams.entity) ? searchParams.entity : "";
  return {
    action,
    entity,
    actor: searchParams.actor?.trim() ?? "",
    from: searchParams.from ?? "",
    to: searchParams.to ?? "",
  };
}

/**
 * Monta a cláusula WHERE compartilhada entre a página (paginada) e a
 * exportação CSV (streaming completo) — mesmos filtros, mesmo resultado.
 * "De"/"Até" usam o horário local do servidor (sem sufixo Z): diferente do
 * bug de fuso das datas de campanha (que são só data, sem hora), aqui
 * created_at é um timestamp real e o usuário espera filtrar por "dia" no
 * fuso em que ele trabalha.
 */
export function buildHistoricoWhere(filters: HistoricoFilterValues) {
  const conditions: SQL[] = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action as AuditAction));
  }
  if (filters.entity) {
    conditions.push(eq(auditLogs.entity, filters.entity as AuditEntity));
  }
  if (filters.actor) {
    conditions.push(ilike(auditLogs.actorLabel, `%${filters.actor}%`));
  }
  if (filters.from) {
    const from = new Date(`${filters.from}T00:00:00`);
    if (!Number.isNaN(from.getTime())) conditions.push(gte(auditLogs.createdAt, from));
  }
  if (filters.to) {
    const to = new Date(`${filters.to}T23:59:59.999`);
    if (!Number.isNaN(to.getTime())) conditions.push(lte(auditLogs.createdAt, to));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
