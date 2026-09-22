import type { AuditAction, AuditEntity } from "@/lib/audit";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  adicionado: "Adicionado",
  editado: "Editado",
  removido: "Removido",
  publicado: "Publicado",
  arquivado: "Arquivado",
  expirado: "Expirado",
  backup: "Backup",
  mudanca_status_tela: "Mudança de status de tela",
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  advertisers: "Anunciantes",
  categories: "Categorias",
  plans: "Planos",
  screens: "Telas",
  campaigns: "Campanhas",
};

export const AUDIT_ACTION_BADGE_VARIANT: Record<
  AuditAction,
  "default" | "secondary" | "destructive"
> = {
  adicionado: "default",
  editado: "secondary",
  removido: "destructive",
  publicado: "default",
  arquivado: "secondary",
  expirado: "destructive",
  backup: "secondary",
  mudanca_status_tela: "secondary",
};
