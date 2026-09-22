import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { advertisers, ads, playLogs, screens } from "@aembi-play/database";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { Clapperboard, ListChecks, Monitor } from "lucide-react";
import { ExibicoesFilters } from "./filters";
import { buildExibicoesWhere, parseExibicoesFilters, type ExibicoesSearchParams } from "./query";

export type ExibicaoRow = {
  advertiserId: string;
  advertiserName: string;
  adId: string;
  adTitle: string;
  screenId: string;
  screenName: string;
  exibicoes: number;
  duracaoTotalSegundos: number;
  primeiraExibicao: string;
  ultimaExibicao: string;
};

async function getExibicoesPageData(searchParams: ExibicoesSearchParams) {
  const filters = parseExibicoesFilters(searchParams);
  const where = buildExibicoesWhere(filters);

  try {
    const [rows, advertiserOptions, screenOptions] = await Promise.all([
      db
        .select({
          advertiserId: advertisers.id,
          advertiserName: advertisers.name,
          adId: ads.id,
          adTitle: ads.title,
          screenId: screens.id,
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
        .orderBy(desc(sql`count(*)`)),
      db.select({ id: advertisers.id, name: advertisers.name }).from(advertisers).orderBy(advertisers.name),
      db
        .select({ id: screens.id, name: screens.name })
        .from(screens)
        .where(isNotNull(screens.pairedAt))
        .orderBy(screens.name),
    ]);

    const totals = {
      exibicoes: rows.reduce((sum, row) => sum + row.exibicoes, 0),
      duracaoTotalSegundos: rows.reduce((sum, row) => sum + row.duracaoTotalSegundos, 0),
      anuncios: new Set(rows.map((row) => row.adId)).size,
      telas: new Set(rows.map((row) => row.screenId)).size,
    };

    return { filters, rows, advertiserOptions, screenOptions, totals, dbAvailable: true as const };
  } catch {
    return {
      filters,
      rows: [] as ExibicaoRow[],
      advertiserOptions: [],
      screenOptions: [],
      totals: { exibicoes: 0, duracaoTotalSegundos: 0, anuncios: 0, telas: 0 },
      dbAvailable: false as const,
    };
  }
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ExibicoesPage({
  searchParams,
}: {
  searchParams: Promise<ExibicoesSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { filters, rows, advertiserOptions, screenOptions, totals, dbAvailable } =
    await getExibicoesPageData(resolvedSearchParams);
  const hasFilters = filters.advertiser || filters.screen || filters.from || filters.to;

  const stats = [
    { label: "Exibições", value: totals.exibicoes.toLocaleString("pt-BR"), icon: ListChecks },
    { label: "Tempo total", value: formatDuration(totals.duracaoTotalSegundos), icon: ListChecks },
    { label: "Anúncios distintos", value: totals.anuncios, icon: Clapperboard },
    { label: "Telas com exibição", value: totals.telas, icon: Monitor },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Exibições
        </h1>
        <p className="text-sm text-muted-foreground">
          Relatório de exibições (proof of play) — comprovação de entrega ao anunciante, a partir do
          que cada player registra localmente e envia em lote (seção 2.3/5.5 do briefing).
        </p>
      </div>

      {!dbAvailable ? (
        <p className="text-sm text-muted-foreground">Não foi possível conectar ao banco de dados.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <ExibicoesFilters
                defaultValues={filters}
                advertisers={advertiserOptions}
                screens={screenOptions}
              />

              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma exibição registrada{hasFilters ? " para esses filtros." : " ainda."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anunciante</TableHead>
                      <TableHead>Anúncio</TableHead>
                      <TableHead>Tela</TableHead>
                      <TableHead className="text-right">Exibições</TableHead>
                      <TableHead className="text-right">Tempo total</TableHead>
                      <TableHead>Primeira exibição</TableHead>
                      <TableHead>Última exibição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.adId}-${row.screenId}`}>
                        <TableCell className="font-medium">{row.advertiserName}</TableCell>
                        <TableCell>{row.adTitle}</TableCell>
                        <TableCell>{row.screenName}</TableCell>
                        <TableCell className="text-right font-[family-name:var(--font-mono)]">
                          {row.exibicoes.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-[family-name:var(--font-mono)]">
                          {formatDuration(row.duracaoTotalSegundos)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(row.primeiraExibicao)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(row.ultimaExibicao)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
