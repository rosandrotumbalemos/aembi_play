"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, DownloadCloud, Pause, Play, PowerOff, RefreshCw, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { enterEmergencyMode, sendForceUpdate, sendPause, sendReload, sendResume } from "./commands-actions";
import { STATUS_LABEL, STATUS_VARIANT } from "./status";

const POLL_MS = 5_000;
const TICK_MS = 1_000;

function formatElapsed(iso: string | null): string {
  if (!iso) return "nunca";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
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
  // Latência real da última consulta (ida e volta até o server action),
  // medida no cliente — diferente do "há Xs" acima, isto é um número de
  // rede de verdade, não um cronômetro extrapolado.
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSending, startSending] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState("");

  async function refresh() {
    setChecking(true);
    const start = performance.now();
    try {
      const result = await getScreenConnectionSnapshot(screen.id);
      setLatencyMs(Math.round(performance.now() - start));
      setSnapshot(result);
    } catch {
      setLatencyMs(null);
    } finally {
      setChecking(false);
    }
  }

  function runCommand(label: string, action: () => Promise<void>) {
    startSending(async () => {
      try {
        await action();
        setActionMessage(`${label} — comando enfileirado.`);
      } catch {
        setActionMessage(`Falha ao enviar "${label}". Tente de novo.`);
      }
      void refresh();
      setTimeout(() => setActionMessage(null), 5000);
    });
  }

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Disparado como callback (não chamado direto no corpo do efeito) só
    // pra satisfazer a regra react-hooks/set-state-in-effect — o
    // comportamento é o mesmo (fetch assim que o diálogo abre).
    void Promise.resolve().then(refresh);
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
              <dd>{formatElapsed(snapshot?.lastSeenAt ?? null)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Última playlist gerada</dt>
              <dd>{formatElapsed(snapshot?.playlistGeneratedAt ?? null)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Latência da consulta</dt>
              <dd className="font-mono">
                {latencyMs !== null ? `${latencyMs}ms` : "—"}
              </dd>
            </div>
          </dl>

          <div className="grid gap-2 rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Controle remoto</div>

            {snapshot?.emergencyMode ? (
              <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                  <div>
                    <div className="text-sm font-medium">Modo de emergência ativo</div>
                    {snapshot.emergencyMessage && (
                      <div className="text-xs text-muted-foreground">
                        &ldquo;{snapshot.emergencyMessage}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSending}
                  onClick={() => runCommand("Sair da emergência", () => sendResume(screen.id))}
                >
                  <Play />
                  Sair
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Mensagem opcional exibida na tela…"
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  className="h-9"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  disabled={isSending}
                  onClick={() =>
                    runCommand("Modo de emergência", async () => {
                      await enterEmergencyMode(screen.id, emergencyMessage);
                      setEmergencyMessage("");
                    })
                  }
                >
                  <AlertTriangle />
                  Emergência
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isSending}
                onClick={() => runCommand("Recarregar", () => sendReload(screen.id))}
              >
                <RotateCw />
                Recarregar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isSending}
                onClick={() => runCommand("Pausar", () => sendPause(screen.id))}
              >
                <Pause />
                Pausar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isSending}
                onClick={() => runCommand("Retomar", () => sendResume(screen.id))}
              >
                <Play />
                Retomar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isSending}
                onClick={() => runCommand("Forçar atualização", () => sendForceUpdate(screen.id))}
              >
                <DownloadCloud />
                Forçar atualização
              </Button>
            </div>

            {actionMessage && <div className="text-xs text-muted-foreground">{actionMessage}</div>}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <PowerOff className="mt-0.5 size-3 shrink-0" />
              Só chega numa tela com o player aberto e conectado (SSE, com
              polling como reserva) — numa tela offline, o comando fica
              guardado e é entregue assim que ela reconectar.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            O sistema não consegue &ldquo;ligar&rdquo; o player remotamente quando a aba
            está fechada ou em segundo plano no iPhone — o player é quem
            consulta o painel, nunca o contrário. Esta tela só confirma, em
            tempo quase real, se um heartbeat chegou depois que você reabriu
            o player. A &ldquo;latência da consulta&rdquo; é o tempo de ida e volta
            entre este navegador e o servidor do painel — não mede a rede
            do iPhone.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
