import { auditLogs } from "@aembi-play/database";
import type { db } from "./db";

export type AuditAction =
  | "adicionado"
  | "editado"
  | "removido"
  | "publicado"
  | "arquivado"
  | "expirado"
  | "backup"
  | "mudanca_status_tela";

export const AUDIT_ENTITIES = [
  "advertisers",
  "categories",
  "plans",
  "screens",
  "campaigns",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

// Só precisa de `.insert()` — aceita tanto o client `db` quanto um `tx` de
// dentro de um db.transaction(), sem acoplar ao tipo exato de nenhum dos
// dois (PostgresJsDatabase e PgTransaction não são o mesmo tipo).
type InsertCapable = Pick<typeof db, "insert">;

/**
 * Log de auditoria (PROJECT_BRIEF.md seção 8) — tabela somente-inserção.
 * Deve ser chamado dentro da MESMA TRANSAÇÃO da operação que registra (por
 * isso recebe `tx` como primeiro argumento em vez de importar `db` direto):
 * se a operação for revertida, o log correspondente também é.
 *
 * Não há autenticação implementada ainda (Fase 3+, ver seção 12 — "Perfis
 * de acesso" segue em aberto). Por isso `actorId` fica sempre nulo e
 * `actorLabel` usa o default "Sistema" do schema. Quando o login existir,
 * os server actions passam `actorId`/`actorLabel` do usuário autenticado.
 */
export async function logAudit(
  tx: InsertCapable,
  entry: {
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    detail?: string | null;
    before?: unknown;
    after?: unknown;
    actorId?: string | null;
    actorLabel?: string;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    actorLabel: entry.actorLabel ?? "Sistema",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    detail: entry.detail ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
