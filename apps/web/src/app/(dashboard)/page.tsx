import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { ads, campaigns, screens } from "@aembi-play/database";
import { count } from "drizzle-orm";
import { Clapperboard, Megaphone, Monitor } from "lucide-react";

async function getCounts() {
  try {
    const [screensCount] = await db.select({ value: count() }).from(screens);
    const [adsCount] = await db.select({ value: count() }).from(ads);
    const [campaignsCount] = await db.select({ value: count() }).from(campaigns);

    return {
      screens: screensCount?.value ?? 0,
      ads: adsCount?.value ?? 0,
      campaigns: campaignsCount?.value ?? 0,
      dbAvailable: true,
    };
  } catch {
    // Banco ainda não provisionado/migrado — comum logo após o scaffold.
    return { screens: 0, ads: 0, campaigns: 0, dbAvailable: false };
  }
}

export default async function DashboardPage() {
  const counts = await getCounts();

  const stats = [
    { label: "Telas cadastradas", value: counts.screens, icon: Monitor },
    { label: "Anúncios", value: counts.ads, icon: Clapperboard },
    { label: "Campanhas", value: counts.campaigns, icon: Megaphone },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral da rede Aembi Play.</p>
      </div>

      {!counts.dbAvailable && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Banco de dados não conectado</CardTitle>
            <CardDescription>
              Rode <code className="font-mono">docker compose up -d</code> e{" "}
              <code className="font-mono">pnpm db:generate &amp;&amp; pnpm db:migrate</code>{" "}
              para ver dados reais aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
