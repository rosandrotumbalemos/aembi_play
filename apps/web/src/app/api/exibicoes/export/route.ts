import { db } from "@/lib/db";
import { advertisers, ads, playLogs, screens } from "@aembi-play/database";
import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { buildExibicoesWhere, parseExibicoesFilters } from "@/app/(dashboard)/exibicoes/query";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * GET /api/exibicoes/export — exportação CSV do relatório de exibições
 * (proof of play, seção 2.3/5.5), com os mesmos filtros (anunciante/
 * tela/período) e a mesma agregação da página — uma linha por combinação
 * anunciante × anúncio × tela, pronta pra mandar pro anunciante como
 * comprovação de entrega.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = parseExibicoesFilters({
    advertiser: url.searchParams.get("advertiser") ?? undefined,
    screen: url.searchParams.get("screen") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const where = buildExibicoesWhere(filters);

  const rows = await db
    .select({
      advertiserName: advertisers.name,
      adTitle: ads.title,
      screenName: screens.name,
      exibicoes: sql<number>`count(*)::int`,
      duracaoTotalSegundos: sql<number>`sum(${playLogs.durationSeconds})::int`,
      primeiraExibicao: sql<string>`min(${playLogs.playedAt})`,
      ultimaExibicao: sql<string>`max(${playLogs.playedAt})`,
    })
    .from(playLogs)
    .innerJoin(ads, eq(playLogs.adId, ads.id))
    .innerJoin(advertisers, eq(ads.advertiserId, advertisers.id))
    .innerJoin(screens, eq(playLogs.screenId, screens.id))
    .where(where)
    .groupBy(advertisers.id, advertisers.name, ads.id, ads.title, screens.id, screens.name)
    .orderBy(desc(sql`count(*)`));

  const header = [
    "Anunciante",
    "Anúncio",
    "Tela",
    "Exibições",
    "Tempo total (s)",
    "Primeira exibição",
    "Última exibição",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.advertiserName,
        row.adTitle,
        row.screenName,
        row.exibicoes,
        row.duracaoTotalSegundos,
        new Date(row.primeiraExibicao).toISOString(),
        new Date(row.ultimaExibicao).toISOString(),
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
      "Content-Disposition": `attachment; filename="exibicoes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
