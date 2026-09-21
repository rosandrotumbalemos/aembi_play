"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ListVideo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setScreenPlaylist } from "./playlist-actions";

type AdOption = {
  id: string;
  title: string;
  durationSeconds: number;
  advertiserName: string | null;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * MVP pra ligar anúncios a uma tela (Playlists de verdade — arrastar e
 * soltar, capacidade de ciclo — é Fase 2, seção 2.3). Aqui é só escolher
 * quais anúncios publicados entram e em que ordem tocam em loop.
 */
export function ScreenPlaylistDialog({
  screen,
  ads,
  currentAdIds,
  open,
  onOpenChange,
}: {
  screen: { id: string; name: string };
  ads: AdOption[];
  currentAdIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [order, setOrder] = useState<string[]>(currentAdIds);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const adById = new Map(ads.map((ad) => [ad.id, ad]));

  function toggle(adId: string, checked: boolean) {
    setOrder((prev) => (checked ? [...prev, adId] : prev.filter((id) => id !== adId)));
  }

  function move(index: number, direction: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(adId: string) {
    setOrder((prev) => prev.filter((id) => id !== adId));
  }

  function handleSubmit() {
    setError(undefined);
    startTransition(async () => {
      const result = await setScreenPlaylist(screen.id, order);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setOrder(currentAdIds);
          setError(undefined);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Playlist — {screen.name}</DialogTitle>
          <DialogDescription>
            Escolha os anúncios publicados que tocam nessa tela, em loop, e a ordem entre eles.
          </DialogDescription>
        </DialogHeader>

        {order.length > 0 && (
          <div className="grid gap-1 rounded-md border p-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">Ordem de reprodução</p>
            {order.map((adId, index) => {
              const ad = adById.get(adId);
              if (!ad) return null;
              return (
                <div
                  key={adId}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                >
                  <span className="w-5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="line-clamp-1 flex-1">{ad.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => remove(adId)}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2">
          {ads.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Nenhum anúncio publicado ainda — envie e valide um em Anúncios primeiro.
            </p>
          ) : (
            ads.map((ad) => {
              const checked = order.includes(ad.id);
              return (
                <label
                  key={ad.id}
                  className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggle(ad.id, value === true)}
                  />
                  <span className="line-clamp-1 flex-1">{ad.title}</span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                    {formatDuration(ad.durationSeconds)}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || order.length === 0}>
            <ListVideo />
            {isPending ? "Salvando..." : "Salvar playlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
