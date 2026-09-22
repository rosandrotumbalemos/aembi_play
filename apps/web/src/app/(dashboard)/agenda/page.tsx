import { db } from "@/lib/db";
import { advertisers, ads, campaignScreens, campaigns, screens } from "@aembi-play/database";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { AgendaClient, type AgendaScreenData } from "./agenda-client";

async function getAgendaPageData() {
  try {
    const now = new Date();

    const [screenRows, entryRows] = await Promise.all([
      db
        .select({ id: screens.id, name: screens.name, location: screens.location })
        .from(screens)
        .where(isNotNull(screens.pairedAt))
        .orderBy(screens.name),
      // Mesmo critério de elegibilidade da geração automática de playlist
      // (playlist-generator.ts, seção 2.3): campanha ativa e dentro da
      // validade (startDate/endDate) agora. A faixa de horário diária e os
      // dias da semana (Fase 3, seção 2.2/2.4/10) não filtram aqui — são
      // justamente o que esta tela visualiza.
      db
        .select({
          screenId: campaignScreens.screenId,
          campaignId: campaigns.id,
          adTitle: ads.title,
          advertiserName: advertisers.name,
          timeWindowStart: campaigns.timeWindowStart,
          timeWindowEnd: campaigns.timeWindowEnd,
          daysOfWeek: campaigns.daysOfWeek,
        })
        .from(campaignScreens)
        .innerJoin(campaigns, eq(campaignScreens.campaignId, campaigns.id))
        .innerJoin(ads, eq(campaigns.adId, ads.id))
        .innerJoin(advertisers, eq(campaigns.advertiserId, advertisers.id))
        .where(and(eq(campaigns.active, true), lte(campaigns.startDate, now), gte(campaigns.endDate, now))),
    ]);

    const entriesByScreenId = new Map<string, AgendaScreenData["entries"]>();
    for (const row of entryRows) {
      const list = entriesByScreenId.get(row.screenId) ?? [];
      list.push({
        campaignId: row.campaignId,
        adTitle: row.adTitle,
        advertiserName: row.advertiserName,
        timeWindowStart: row.timeWindowStart,
        timeWindowEnd: row.timeWindowEnd,
        daysOfWeek: row.daysOfWeek.length > 0 ? row.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
      });
      entriesByScreenId.set(row.screenId, list);
    }

    const screensData: AgendaScreenData[] = screenRows.map((screen) => ({
      id: screen.id,
      name: screen.name,
      location: screen.location,
      entries: entriesByScreenId.get(screen.id) ?? [],
    }));

    return { screensData, dbAvailable: true as const };
  } catch {
    return { screensData: [] as AgendaScreenData[], dbAvailable: false as const };
  }
}

export default async function AgendaPage() {
  const { screensData, dbAvailable } = await getAgendaPageData();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Agenda
        </h1>
        <p className="text-sm text-muted-foreground">
          Programação por faixa horária e dias da semana, por tela.
        </p>
      </div>

      {!dbAvailable ? (
        <p className="text-sm text-muted-foreground">Não foi possível conectar ao banco de dados.</p>
      ) : screensData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tela pareada ainda — pareie uma tela em Telas primeiro.
        </p>
      ) : (
        <AgendaClient screens={screensData} />
      )}
    </div>
  );
}
