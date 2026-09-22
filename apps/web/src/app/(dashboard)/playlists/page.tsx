import { db } from "@/lib/db";
import { ads, advertisers, campaignScreens, campaigns, screens } from "@aembi-play/database";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { PlaylistsClient, type PlaylistItem, type ScreenPlaylistData } from "./playlists-client";

export type { PlaylistItem };

type PlaylistRow = {
  screen_id: string;
  items: PlaylistItem[];
  loop_duration_seconds: number;
  generated_at: string;
};

async function getPlaylistsPageData() {
  try {
    const [screenRows, adRows, latestPlaylistRows, activeCampaignScreenRows] = await Promise.all([
      db
        .select({ id: screens.id, name: screens.name, location: screens.location })
        .from(screens)
        .where(isNotNull(screens.pairedAt))
        .orderBy(screens.name),
      db
        .select({
          id: ads.id,
          title: ads.title,
          durationSeconds: ads.durationSeconds,
          advertiserName: advertisers.name,
        })
        .from(ads)
        .leftJoin(advertisers, eq(ads.advertiserId, advertisers.id))
        .where(eq(ads.status, "publicado")),
      // Última playlist (maior generated_at) por tela — mesma técnica do
      // "distinct on" usado em anuncios/page.tsx pro último job por anúncio.
      db.execute<PlaylistRow>(sql`
        select distinct on (screen_id)
          screen_id, items, loop_duration_seconds, generated_at
        from playlists
        order by screen_id, generated_at desc
      `),
      // Telas com pelo menos uma campanha ativa e dentro da validade agora
      // — a próxima geração automática (criar/pausar/reativar campanha, ou
      // "Gerar playlist automaticamente" em Telas) vai substituir qualquer
      // playlist manual definida aqui.
      db
        .selectDistinct({ screenId: campaignScreens.screenId })
        .from(campaignScreens)
        .innerJoin(campaigns, eq(campaignScreens.campaignId, campaigns.id))
        .where(
          and(eq(campaigns.active, true), lte(campaigns.startDate, new Date()), gte(campaigns.endDate, new Date())),
        ),
    ]);

    const playlistByScreenId = new Map(latestPlaylistRows.map((row) => [row.screen_id, row]));
    const activeCampaignScreenIds = new Set(activeCampaignScreenRows.map((row) => row.screenId));

    const screensData: ScreenPlaylistData[] = screenRows.map((screen) => {
      const playlist = playlistByScreenId.get(screen.id);
      return {
        id: screen.id,
        name: screen.name,
        location: screen.location,
        items: playlist?.items ?? [],
        loopDurationSeconds: playlist?.loop_duration_seconds ?? 0,
        generatedAt: playlist?.generated_at ?? null,
        hasActiveCampaigns: activeCampaignScreenIds.has(screen.id),
      };
    });

    return { screensData, adRows, dbAvailable: true as const };
  } catch {
    return { screensData: [], adRows: [], dbAvailable: false as const };
  }
}

export default async function PlaylistsPage() {
  const { screensData, adRows, dbAvailable } = await getPlaylistsPageData();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Playlists
        </h1>
        <p className="text-sm text-muted-foreground">
          Loop materializado por tela, com arrastar e soltar.
        </p>
      </div>

      {!dbAvailable ? (
        <p className="text-sm text-muted-foreground">Não foi possível conectar ao banco de dados.</p>
      ) : screensData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tela pareada ainda — pareie uma tela em Telas primeiro.
        </p>
      ) : (
        <PlaylistsClient screens={screensData} ads={adRows} />
      )}
    </div>
  );
}
