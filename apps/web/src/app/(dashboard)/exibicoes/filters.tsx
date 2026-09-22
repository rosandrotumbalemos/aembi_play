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
import type { ExibicoesFilterValues } from "./query";

type Option = { id: string; name: string };

/** Filtros do Relatório de exibições (seção 2.3/5.5): anunciante, tela e
 * período — mesmo padrão do Histórico (filters.tsx). */
export function ExibicoesFilters({
  defaultValues,
  advertisers,
  screens,
}: {
  defaultValues: ExibicoesFilterValues;
  advertisers: Option[];
  screens: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(params: URLSearchParams) {
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
    for (const key of ["from", "to"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    navigate(params);
  }

  function handleClear() {
    startTransition(() => router.push(pathname));
  }

  const hasFilters = defaultValues.advertiser || defaultValues.screen || defaultValues.from || defaultValues.to;
  const exportHref = `/api/exibicoes/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-2">
        <Label htmlFor="filter-advertiser">Anunciante</Label>
        <Select
          value={defaultValues.advertiser || "all"}
          onValueChange={(value) => updateParam("advertiser", !value || value === "all" ? "" : value)}
        >
          <SelectTrigger id="filter-advertiser" className="w-52">
            <SelectValue>
              {(value: string | null) =>
                value && value !== "all"
                  ? (advertisers.find((a) => a.id === value)?.name ?? "Todos os anunciantes")
                  : "Todos os anunciantes"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anunciantes</SelectItem>
            {advertisers.map((advertiser) => (
              <SelectItem key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-screen">Tela</Label>
        <Select
          value={defaultValues.screen || "all"}
          onValueChange={(value) => updateParam("screen", !value || value === "all" ? "" : value)}
        >
          <SelectTrigger id="filter-screen" className="w-44">
            <SelectValue>
              {(value: string | null) =>
                value && value !== "all" ? (screens.find((s) => s.id === value)?.name ?? "Todas as telas") : "Todas as telas"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as telas</SelectItem>
            {screens.map((screen) => (
              <SelectItem key={screen.id} value={screen.id}>
                {screen.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
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
