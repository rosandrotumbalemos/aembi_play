"use client";

import { useState } from "react";
import { CalendarClock, MonitorPlay } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

export type AgendaCampaignEntry = {
  campaignId: string;
  adTitle: string;
  advertiserName: string;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  daysOfWeek: number[];
};

export type AgendaScreenData = {
  id: string;
  name: string;
  location: string | null;
  entries: AgendaCampaignEntry[];
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_MARKS = ["00h", "06h", "12h", "18h", "24h"];

// Paleta neutra do design system (seção 9.3 — identidade visual provisória,
// só uma cor de destaque definida até agora). São tons de cinza — a
// distinção entre campanhas vem da legenda, não do matiz.
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];
// chart-1 é claro o bastante pra pedir texto escuro; o resto é texto branco.
const CHART_TEXT_CLASS = ["text-foreground", "text-white", "text-white", "text-white", "text-white"];

function colorIndexForCampaign(campaignId: string): number {
  let hash = 0;
  for (let i = 0; i < campaignId.length; i++) {
    hash = (hash * 31 + campaignId.charCodeAt(i)) >>> 0;
  }
  return hash % CHART_COLORS.length;
}

type Segment = { startPct: number; widthPct: number };

/**
 * Um item sem faixa de horário vale o dia inteiro (um segmento 0–100%). Com
 * faixa, vira 1 segmento (início < fim) ou 2 segmentos dentro do mesmo dia
 * quando a faixa cruza a meia-noite (início > fim, ex. "22:00"–"06:00") —
 * mesma leitura que apps/player/src/main.ts (isItemEligibleNow) faz: o dia
 * corrente cobre tanto o fim da noite quanto a madrugada seguinte, sem
 * precisar que o dia seguinte também esteja em daysOfWeek.
 */
function windowSegments(start: string | null, end: string | null): Segment[] {
  if (!start || !end) return [{ startPct: 0, widthPct: 100 }];

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (startMin === endMin) return [{ startPct: 0, widthPct: 100 }];

  if (startMin < endMin) {
    return [{ startPct: (startMin / 1440) * 100, widthPct: ((endMin - startMin) / 1440) * 100 }];
  }

  return [
    { startPct: 0, widthPct: (endMin / 1440) * 100 },
    { startPct: (startMin / 1440) * 100, widthPct: ((1440 - startMin) / 1440) * 100 },
  ];
}

function formatSchedule(entry: AgendaCampaignEntry): string {
  const time =
    entry.timeWindowStart && entry.timeWindowEnd
      ? `${entry.timeWindowStart}–${entry.timeWindowEnd}`
      : "dia inteiro";
  const days =
    entry.daysOfWeek.length === 7
      ? "todo dia"
      : [...entry.daysOfWeek].sort((a, b) => a - b).map((day) => DAY_LABELS[day]).join("/");
  return `${time} · ${days}`;
}

/**
 * Linha do tempo semanal por tela (seção 9.2 — "agenda em calendário/linha
 * do tempo"). Mostra as mesmas campanhas que a geração automática de
 * playlist considera elegíveis agora (ativa + dentro de startDate/endDate,
 * ver page.tsx) — a faixa de horário e os dias da semana aqui são
 * justamente o que decide, a cada instante, o que o player exibe (Fase 3,
 * seção 2.2/2.4/10).
 */
export function AgendaClient({ screens }: { screens: AgendaScreenData[] }) {
  const [selectedId, setSelectedId] = useState(screens[0]?.id);
  const selected = screens.find((screen) => screen.id === selectedId) ?? screens[0];

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        {screens.map((screen) => {
          const isSelected = screen.id === selected?.id;
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
              <span className="flex items-center gap-1.5 font-medium">
                <MonitorPlay className="size-4 text-muted-foreground" />
                {screen.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {screen.entries.length === 0
                  ? "Nenhuma campanha ativa agora"
                  : `${new Set(screen.entries.map((e) => e.campaignId)).size} campanha(s) ativa(s)`}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" />
              {selected.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Campanhas ativas e dentro da validade agora, por dia da semana e horário.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {selected.entries.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhuma campanha ativa e dentro da validade nessa tela agora — o player toca a última
                playlist gerada (manual ou automática) sem restrição de horário.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {(() => {
                    // Raia fixa por campanha (estável entre os dias — a mesma
                    // campanha sempre ocupa a mesma raia vertical, mesmo em
                    // dias diferentes) pra campanhas que se sobrepõem no
                    // mesmo dia não se cobrirem: sem isso, uma campanha "dia
                    // inteiro" (barra de 0 a 100%) esconde por cima qualquer
                    // outra do mesmo dia.
                    const distinctEntries = [
                      ...new Map(selected.entries.map((entry) => [entry.campaignId, entry])).values(),
                    ];
                    const laneIndexByCampaignId = new Map(
                      distinctEntries.map((entry, index) => [entry.campaignId, index]),
                    );
                    const LANE_HEIGHT = 22;
                    const LANE_GAP = 4;
                    const trackHeight = distinctEntries.length * LANE_HEIGHT + (distinctEntries.length - 1) * LANE_GAP + 4;

                    return DAY_LABELS.map((label, day) => {
                      const dayEntries = selected.entries.filter((entry) => entry.daysOfWeek.includes(day));
                      return (
                        <div key={day} className="grid grid-cols-[2.5rem_1fr] items-start gap-2">
                          <span className="pt-1 text-xs text-muted-foreground">{label}</span>
                          <div
                            className="relative overflow-hidden rounded-md bg-muted"
                            style={{
                              height: trackHeight,
                              backgroundImage:
                                "repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 25%)",
                            }}
                          >
                            {dayEntries.flatMap((entry) => {
                              const colorIndex = colorIndexForCampaign(entry.campaignId);
                              const lane = laneIndexByCampaignId.get(entry.campaignId) ?? 0;
                              const top = 2 + lane * (LANE_HEIGHT + LANE_GAP);
                              return windowSegments(entry.timeWindowStart, entry.timeWindowEnd).map(
                                (segment, segIndex) => (
                                  <div
                                    key={`${entry.campaignId}-${day}-${segIndex}`}
                                    className={cn(
                                      "absolute flex items-center overflow-hidden rounded px-1.5 text-[10px] font-medium whitespace-nowrap",
                                      CHART_TEXT_CLASS[colorIndex],
                                    )}
                                    style={{
                                      top,
                                      height: LANE_HEIGHT - 4,
                                      left: `${segment.startPct}%`,
                                      width: `${segment.widthPct}%`,
                                      backgroundColor: CHART_COLORS[colorIndex],
                                    }}
                                    title={`${entry.advertiserName} — ${entry.adTitle} (${formatSchedule(entry)})`}
                                  >
                                    <span className="truncate">{entry.adTitle}</span>
                                  </div>
                                ),
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div className="grid grid-cols-[2.5rem_1fr] gap-2">
                    <span />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      {HOUR_MARKS.map((mark) => (
                        <span key={mark}>{mark}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t pt-4">
                  {[...new Map(selected.entries.map((entry) => [entry.campaignId, entry])).values()].map(
                    (entry) => (
                      <div key={entry.campaignId} className="flex items-center gap-2 text-xs">
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: CHART_COLORS[colorIndexForCampaign(entry.campaignId)] }}
                        />
                        <span className="font-medium">{entry.advertiserName}</span>
                        <span className="text-muted-foreground">— {entry.adTitle}</span>
                        <span className="ml-auto font-[family-name:var(--font-mono)] text-muted-foreground">
                          {formatSchedule(entry)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione uma tela.</p>
      )}
    </div>
  );
}
