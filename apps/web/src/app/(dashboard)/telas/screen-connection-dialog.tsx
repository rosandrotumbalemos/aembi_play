"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getScreenConnectionSnapshot,
  type ScreenConnectionSnapshot,
} from "./connection-actions";
import { STATUS_LABEL, STATUS_VARIANT } from "./status";

const POLL_MS = 5_000;
const TICK_MS = 100; // granularidade do "há Xs (Yms)" abaixo de 1 min

/**
 * `precise` mostra os ms restantes (abaixo de 1 min) — só faz sentido pro
 * heartbeat, que é o número acompanhado ao vivo pra confirmar que chegou.
 */
function formatElapsed(iso: string | null, precise = false): string {
  if (!iso) return "nunca";
  const totalMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.floor(totalMs / 1000);

  if (seconds < 60) {
    return precise ? `há ${seconds}s (${totalMs % 1000}ms)` : `há ${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h`;
}

/**
 * Diagnóstico de conexão sob demanda — não existe canal do painel pro player
 * (arquitetura pull-only, ver connection-actions.ts), então isto não "liga"
 * a tela. O valor é reconsultar `last_seen_at` a cada poucos segundos
 * enquanto aberto: o operador reabre o player no aparelho e acompanha aqui,
 * quase em tempo real, se o heartbeat chegou — sem precisar recarregar a
 * página inteira e adivinhar.
 */
export function ScreenConnectionDialog({
  screen,
  open,
  onOpenChange,
}: {
  screen: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<ScreenConnectionSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [, forceTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    setChecking(true);
    try {
      setSnapshot(await getScreenConnectionSnapshot(screen.id));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    void refresh();
    intervalRef.current = setInterval(() => void refresh(), POLL_MS);
    // Reflete o "há Xs" no relógio entre um poll e outro, sem esperar o
    // próximo fetch pra atualizar o texto na tela.
    const tick = setInterval(() => forceTick((n) => n + 1), TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verificar conexão — {screen.name}</DialogTitle>
          <DialogDescription>
            Reabra o player no aparelho e deixe a aba em primeiro plano (tela
            desbloqueada). O heartbeat chega a cada ~45s — o status abaixo
            atualiza sozinho, sem precisar recarregar a página.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-1">
                {snapshot ? (
                  <Badge variant={STATUS_VARIANT[snapshot.status]} className="text-sm">
                    {STATUS_LABEL[snapshot.status]}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Consultando…</span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={checking}
            >
              <RefreshCw className={checking ? "animate-spin" : ""} />
              Atualizar agora
            </Button>
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Último heartbeat</dt>
              <dd className="font-mono">{formatElapsed(snapshot?.lastSeenAt ?? null, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Última playlist gerada</dt>
              <dd>{formatElapsed(snapshot?.playlistGeneratedAt ?? null)}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            O sistema não consegue "ligar" o player remotamente quando a aba
            está fechada ou em segundo plano no iPhone — o player é quem
            consulta o painel, nunca o contrário. Esta tela só confirma, em
            tempo quase real, se um heartbeat chegou depois que você reabriu
            o player.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
