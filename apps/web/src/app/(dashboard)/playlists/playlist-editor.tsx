"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListVideo, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setScreenPlaylist } from "../telas/playlist-actions";
import type { AdOption, ScreenPlaylistData } from "./playlists-client";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Row = { key: string; adId: string };

function makeKey(adId: string) {
  return `${adId}-${Math.random().toString(36).slice(2)}`;
}

function SortableRow({
  row,
  ad,
  index,
  onRemove,
}: {
  row: Row;
  ad: AdOption | undefined;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-2 text-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
        {index + 1}
      </span>
      <span className="line-clamp-1 flex-1">{ad?.title ?? "Anúncio removido da Biblioteca"}</span>
      {ad?.advertiserName && (
        <span className="hidden text-xs text-muted-foreground sm:inline">{ad.advertiserName}</span>
      )}
      {ad && (
        <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
          {formatDuration(ad.durationSeconds)}
        </span>
      )}
      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

/**
 * Editor de arrastar-e-soltar do loop de uma tela (a peça que faltava da
 * seção 9.2 — "Playlists com arrastar e soltar"). Reaproveita
 * `setScreenPlaylist` (mesma action do diálogo manual em Telas): grava uma
 * nova versão em `playlists`, substituindo a mais recente. Igual ali, ads
 * repetidos são permitidos (a geração automática por round-robin também
 * produz repetição quando o plano tem mais de uma inserção por ciclo), por
 * isso cada linha tem uma chave própria em vez de usar o adId como key.
 */
export function PlaylistEditor({ screen, ads }: { screen: ScreenPlaylistData; ads: AdOption[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    screen.items
      .filter((item): item is { adId: string; durationSeconds: number; slotIndex: number } => !!item.adId)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((item) => ({ key: makeKey(item.adId), adId: item.adId })),
  );
  const [addValue, setAddValue] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const adById = new Map(ads.map((ad) => [ad.id, ad]));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((row) => row.key === active.id);
      const newIndex = prev.findIndex((row) => row.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleAdd() {
    if (!addValue) return;
    setRows((prev) => [...prev, { key: makeKey(addValue), adId: addValue }]);
    setAddValue("");
  }

  function handleRemove(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function handleSave() {
    setError(undefined);
    setSuccess(false);
    startTransition(async () => {
      const result = await setScreenPlaylist(
        screen.id,
        rows.map((row) => row.adId),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  const loopDurationSeconds = rows.reduce((sum, row) => sum + (adById.get(row.adId)?.durationSeconds ?? 0), 0);
  const loopLabel = `${Math.floor(loopDurationSeconds / 60)}:${String(Math.round(loopDurationSeconds % 60)).padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{screen.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {rows.length} inserção{rows.length === 1 ? "" : "ões"} — loop de {loopLabel}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum anúncio nessa playlist ainda. Adicione um abaixo.
          </p>
        ) : (
          <DndContext
            id={`playlist-${screen.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={rows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {rows.map((row, index) => (
                  <SortableRow
                    key={row.key}
                    row={row}
                    ad={adById.get(row.adId)}
                    index={index}
                    onRemove={() => handleRemove(row.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex items-end gap-2 border-t pt-4">
          <div className="flex-1">
            <Select value={addValue} onValueChange={(value) => setAddValue(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => adById.get(value ?? "")?.title ?? "Escolha um anúncio publicado"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ads.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum anúncio publicado — envie e valide um em Anúncios primeiro.
                  </div>
                ) : (
                  ads.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id}>
                      {ad.title} — {formatDuration(ad.durationSeconds)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" disabled={!addValue} onClick={handleAdd}>
            <Plus />
            Adicionar
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Playlist salva.</p>}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isPending || rows.length === 0}>
            <ListVideo />
            {isPending ? "Salvando..." : "Salvar playlist"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
