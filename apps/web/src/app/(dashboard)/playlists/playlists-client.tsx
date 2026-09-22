"use client";

import { useState } from "react";
import { AlertTriangle, MonitorPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";
import { PlaylistEditor } from "./playlist-editor";

export type PlaylistItem = { adId: string | null; durationSeconds: number; slotIndex: number };

export type ScreenPlaylistData = {
  id: string;
  name: string;
  location: string | null;
  items: PlaylistItem[];
  loopDurationSeconds: number;
  generatedAt: string | null;
  /** Tem campanha ativa e dentro da validade agora — a playlist dessa tela é
   * recalculada automaticamente e uma edição manual aqui pode ser sobrescrita
   * na próxima geração (criar/pausar/reativar campanha). */
  hasActiveCampaigns: boolean;
};

export type AdOption = {
  id: string;
  title: string;
  durationSeconds: number;
  advertiserName: string | null;
};

function formatLoop(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Shell da página Playlists: lista de telas à esquerda (com um resumo do
 * estado — automática, manual ou vazia) e o editor de arrastar-e-soltar da
 * tela selecionada à direita.
 */
export function PlaylistsClient({ screens, ads }: { screens: ScreenPlaylistData[]; ads: AdOption[] }) {
  const [selectedId, setSelectedId] = useState(screens[0]?.id);
  const selected = screens.find((screen) => screen.id === selectedId) ?? screens[0];

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        {screens.map((screen) => {
          const isSelected = screen.id === selected?.id;
          const itemCount = screen.items.length;
          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => setSelectedId(screen.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted",
                isSelected && "border-primary bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <MonitorPlay className="size-4 text-muted-foreground" />
                  {screen.name}
                </span>
                {screen.hasActiveCampaigns ? (
                  <Badge variant="secondary" title="Recalculada automaticamente pelas campanhas ativas">
                    Automática
                  </Badge>
                ) : itemCount > 0 ? (
                  <Badge variant="outline">Manual</Badge>
                ) : (
                  <Badge variant="outline">Vazia</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {itemCount === 0
                  ? "Sem anúncios"
                  : `${itemCount} inserção${itemCount === 1 ? "" : "ões"} — loop de ${formatLoop(screen.loopDurationSeconds)}`}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="flex flex-col gap-4">
          {selected.hasActiveCampaigns && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-start gap-2 pt-6 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  Essa tela tem campanha ativa dentro da validade — a playlist dela é recalculada
                  automaticamente (seção 2.3). Uma alteração manual salva aqui vale até a próxima
                  geração automática, que pode substituí-la.
                </p>
              </CardContent>
            </Card>
          )}
          <PlaylistEditor key={selected.id} screen={selected} ads={ads} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione uma tela.</p>
      )}
    </div>
  );
}
