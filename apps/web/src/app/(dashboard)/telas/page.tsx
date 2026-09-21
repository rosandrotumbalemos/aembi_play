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
import { ads, advertisers, screens } from "@aembi-play/database";
import { desc, eq, sql } from "drizzle-orm";
import { PairScreenDialog } from "./pair-screen-dialog";
import { ScreenRowActions } from "./screen-row-actions";

const SEM_SINAL_MS = 2 * 60 * 1000; // "Sem sinal": mais de 2 min sem heartbeat (seção 2.5)

function screenStatus(lastSeenAt: Date | null): "online" | "sem_sinal" | "offline" {
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - lastSeenAt.getTime();
  if (elapsed <= SEM_SINAL_MS) return "online";
  if (elapsed <= SEM_SINAL_MS * 5) return "sem_sinal";
  return "offline";
}

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  sem_sinal: "Sem sinal",
  offline: "Offline",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  online: "default",
  sem_sinal: "secondary",
  offline: "destructive",
};

type PlaylistItem = { adId: string | null; durationSeconds: number; slotIndex: number };
type AdOption = {
  id: string;
  title: string;
  durationSeconds: number;
  advertiserName: string | null;
};

async function getScreens() {
  try {
    const [rows, adRows, playlistRows] = await Promise.all([
      db.select().from(screens).orderBy(desc(screens.createdAt)),
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
      // Última playlist por tela (mesma técnica do "último job" em /anuncios).
      db.execute<{ screen_id: string; items: PlaylistItem[] }>(sql`
        select distinct on (screen_id) screen_id, items
        from playlists
        order by screen_id, generated_at desc
      `),
    ]);

    const currentAdIdsByScreen = new Map<string, string[]>(
      playlistRows.map((row) => [
        row.screen_id,
        [...row.items]
          .sort((a, b) => a.slotIndex - b.slotIndex)
          .map((item) => item.adId)
          .filter((adId): adId is string => adId !== null),
      ]),
    );

    return {
      rows,
      adOptions: adRows as AdOption[],
      currentAdIdsByScreen,
      dbAvailable: true,
    };
  } catch {
    return {
      rows: [],
      adOptions: [] as AdOption[],
      currentAdIdsByScreen: new Map<string, string[]>(),
      dbAvailable: false,
    };
  }
}

export default async function TelasPage() {
  const { rows, adOptions, currentAdIdsByScreen, dbAvailable } = await getScreens();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            Telas
          </h1>
          <p className="text-sm text-muted-foreground">
            Pareamento, orientação e status online (heartbeat a cada 30–60s).
          </p>
        </div>
        <PairScreenDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telas cadastradas</CardTitle>
          <CardDescription>
            {dbAvailable
              ? "Um player gera um código ao abrir pela primeira vez — clique em “Parear tela” e digite o código para vincular."
              : "Banco de dados não conectado — rode as migrations para ver dados reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Orientação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pareada em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma tela cadastrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((screen) => {
                  const status = screenStatus(screen.lastSeenAt);
                  const awaitingPairing = !screen.pairedAt;

                  return (
                    <TableRow key={screen.id}>
                      <TableCell className="font-medium">{screen.name}</TableCell>
                      <TableCell>{screen.location ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{screen.orientation}°</TableCell>
                      <TableCell>
                        {awaitingPairing ? (
                          <Badge variant="secondary">Aguardando pareamento</Badge>
                        ) : (
                          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {screen.pairedAt
                          ? new Date(screen.pairedAt).toLocaleString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {!awaitingPairing && (
                          <ScreenRowActions
                            screen={{
                              id: screen.id,
                              name: screen.name,
                              location: screen.location,
                              orientation: screen.orientation,
                            }}
                            ads={adOptions}
                            currentAdIds={currentAdIdsByScreen.get(screen.id) ?? []}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
