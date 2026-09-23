import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { advertisers, ads, plans, screens } from "@aembi-play/database";
import { eq, isNotNull } from "drizzle-orm";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { CampaignRowActions } from "./campaign-row-actions";

function getCampaigns() {
  return db.query.campaigns.findMany({
    with: {
      advertiser: { columns: { name: true } },
      ad: { columns: { title: true } },
      plan: { columns: { name: true, maxScreens: true } },
      campaignScreens: { with: { screen: { columns: { name: true } } } },
    },
    orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
  });
}

async function getCampaignsPageData() {
  try {
    const [campaignRows, advertiserRows, adRows, planRows, screenRows] = await Promise.all([
      getCampaigns(),
      db.select({ id: advertisers.id, name: advertisers.name }).from(advertisers).orderBy(advertisers.name),
      db
        .select({
          id: ads.id,
          title: ads.title,
          advertiserId: ads.advertiserId,
          durationSeconds: ads.durationSeconds,
        })
        .from(ads)
        .where(eq(ads.status, "publicado")),
      db.select({ id: plans.id, name: plans.name, maxScreens: plans.maxScreens }).from(plans).orderBy(plans.name),
      db
        .select({ id: screens.id, name: screens.name, location: screens.location })
        .from(screens)
        .where(isNotNull(screens.pairedAt))
        .orderBy(screens.name),
    ]);

    return {
      campaigns: campaignRows,
      advertisers: advertiserRows,
      ads: adRows,
      plans: planRows,
      screens: screenRows,
      dbAvailable: true,
    };
  } catch {
    return {
      campaigns: [] as Awaited<ReturnType<typeof getCampaigns>>,
      advertisers: [],
      ads: [],
      plans: [],
      screens: [],
      dbAvailable: false,
    };
  }
}

/**
 * `campaigns.start_date`/`end_date` são datas puras (sem hora relevante,
 * ver actions.ts) gravadas como meia-noite/23:59:59 UTC. Formatar sem fixar
 * `timeZone: "UTC"` aqui deixaria o servidor "voltar" um dia em fusos atrás
 * de UTC (ex.: America/Sao_Paulo) — bug real que apareceu no teste.
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Resumo do agendamento fino (Fase 3) abaixo da validade — só aparece
 * quando difere do padrão "todo dia, o dia inteiro". */
function formatSchedule(campaign: {
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  daysOfWeek: number[];
}): string | null {
  const parts: string[] = [];
  if (campaign.timeWindowStart && campaign.timeWindowEnd) {
    parts.push(`${campaign.timeWindowStart}–${campaign.timeWindowEnd}`);
  }
  if (campaign.daysOfWeek.length > 0 && campaign.daysOfWeek.length < 7) {
    parts.push(
      [...campaign.daysOfWeek].sort((a, b) => a - b).map((day) => DAY_LABELS[day]).join("/"),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function CampanhasPage() {
  const { campaigns, advertisers, ads, plans, screens, dbAvailable } =
    await getCampaignsPageData();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            Campanhas
          </h1>
          <p className="text-sm text-muted-foreground">
            Anunciante → anúncio → telas → horário → datas → plano.
          </p>
        </div>
        <NewCampaignDialog advertisers={advertisers} ads={ads} plans={plans} screens={screens} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas cadastradas</CardTitle>
          <CardDescription>
            {dbAvailable
              ? "A geração automática de playlist (próxima etapa) monta o loop de cada tela a partir das campanhas ativas."
              : "Banco de dados não conectado — rode as migrations para ver dados reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anunciante</TableHead>
                <TableHead>Anúncio</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Telas</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma campanha cadastrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.advertiser.name}</TableCell>
                    <TableCell>{campaign.ad.title}</TableCell>
                    <TableCell>{campaign.plan.name}</TableCell>
                    <TableCell>
                      {campaign.campaignScreens.map((cs) => cs.screen.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>
                        {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                      </div>
                      {formatSchedule(campaign) && (
                        <div className="text-muted-foreground">{formatSchedule(campaign)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={campaign.active ? "success" : "secondary"}>
                        {campaign.active ? "Ativa" : "Pausada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CampaignRowActions id={campaign.id} active={campaign.active} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
