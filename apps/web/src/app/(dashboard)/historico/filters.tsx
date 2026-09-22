"use client";

import { useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditAction, AuditEntity } from "@/lib/audit";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "./labels";

const ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];
const ENTITIES = Object.keys(AUDIT_ENTITY_LABELS) as AuditEntity[];

/**
 * Filtros do Histórico (seção 8): ação, período e usuário — mais entidade,
 * que não estava no briefing mas ajuda a achar um registro específico numa
 * tabela que cresce rápido. Select de ação/entidade navega na hora
 * (onValueChange); usuário/período vão num mini-form que só navega ao
 * enviar, pra não disparar uma requisição por tecla digitada.
 */
export function HistoricoFilters({
  defaultValues,
}: {
  defaultValues: { action: string; entity: string; actor: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(params: URLSearchParams) {
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    navigate(params);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["actor", "from", "to"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    navigate(params);
  }

  function handleClear() {
    startTransition(() => router.push(pathname));
  }

  const hasFilters =
    defaultValues.action || defaultValues.entity || defaultValues.actor || defaultValues.from || defaultValues.to;
  const exportHref = `/api/historico/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-2">
        <Label htmlFor="filter-action">Ação</Label>
        <Select
          value={defaultValues.action || "all"}
          onValueChange={(value) => updateParam("action", !value || value === "all" ? "" : value)}
        >
          <SelectTrigger id="filter-action" className="w-52">
            <SelectValue>
              {(value: string | null) =>
                value && value !== "all" ? AUDIT_ACTION_LABELS[value as AuditAction] : "Todas as ações"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {AUDIT_ACTION_LABELS[action]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-entity">Entidade</Label>
        <Select
          value={defaultValues.entity || "all"}
          onValueChange={(value) => updateParam("entity", !value || value === "all" ? "" : value)}
        >
          <SelectTrigger id="filter-entity" className="w-44">
            <SelectValue>
              {(value: string | null) =>
                value && value !== "all" ? AUDIT_ENTITY_LABELS[value as AuditEntity] : "Todas as entidades"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            {ENTITIES.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {AUDIT_ENTITY_LABELS[entity]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="actor">Usuário</Label>
          <Input
            id="actor"
            name="actor"
            defaultValue={defaultValues.actor}
            placeholder="Ex.: Sistema"
            className="w-36"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="from">De</Label>
          <Input id="from" name="from" type="date" defaultValue={defaultValues.from} className="w-40" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to">Até</Label>
          <Input id="to" name="to" type="date" defaultValue={defaultValues.to} className="w-40" />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          Filtrar
        </Button>
      </form>

      {hasFilters && (
        <Button type="button" variant="ghost" onClick={handleClear} disabled={isPending}>
          <X />
          Limpar
        </Button>
      )}

      <a href={exportHref} className={buttonVariants({ variant: "outline" })}>
        <Download />
        Exportar CSV
      </a>
    </div>
  );
}
