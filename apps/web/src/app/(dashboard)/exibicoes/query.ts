import { advertisers, playLogs } from "@aembi-play/database";
import { and, eq, gte, lte, type SQL } from "drizzle-orm";

export type ExibicoesSearchParams = {
  advertiser?: string;
  screen?: string;
  from?: string;
  to?: string;
};

export type ExibicoesFilterValues = {
  advertiser: string;
  screen: string;
  from: string;
  to: string;
};

/** Normaliza os query params — sem validar contra listas conhecidas porque,
 * diferente de ação/entidade no Histórico (enums fechados), advertiser/screen
 * são UUIDs de tabelas que mudam; um id inexistente só resulta em "0
 * resultados", sem risco de SQL inválido (eq() compara como texto). */
export function parseExibicoesFilters(searchParams: ExibicoesSearchParams): ExibicoesFilterValues {
  return {
    advertiser: searchParams.advertiser ?? "",
    screen: searchParams.screen ?? "",
    from: searchParams.from ?? "",
    to: searchParams.to ?? "",
  };
}

/**
 * Cláusula WHERE compartilhada entre a página (agregada) e a exportação CSV
 * — mesmos filtros, mesmo resultado. "De"/"Até" usam o horário local do
 * servidor, como no Histórico (buildHistoricoWhere) — o usuário pensa em
 * "dia", não em UTC.
 */
export function buildExibicoesWhere(filters: ExibicoesFilterValues) {
  const conditions: SQL[] = [];

  if (filters.advertiser) conditions.push(eq(advertisers.id, filters.advertiser));
  if (filters.screen) conditions.push(eq(playLogs.screenId, filters.screen));
  if (filters.from) {
    const from = new Date(`${filters.from}T00:00:00`);
    if (!Number.isNaN(from.getTime())) conditions.push(gte(playLogs.playedAt, from));
  }
  if (filters.to) {
    const to = new Date(`${filters.to}T23:59:59.999`);
    if (!Number.isNaN(to.getTime())) conditions.push(lte(playLogs.playedAt, to));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
