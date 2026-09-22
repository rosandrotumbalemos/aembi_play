"use client";

import { useState, useTransition } from "react";
import { ListVideo, MoreHorizontal, Pencil, RefreshCw, Unlink, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditScreenDialog } from "./edit-screen-dialog";
import { ScreenPlaylistDialog } from "./screen-playlist-dialog";
import { ScreenConnectionDialog } from "./screen-connection-dialog";
import { regenerateScreenPlaylist, unpairScreen } from "./actions";

type ScreenRow = {
  id: string;
  name: string;
  location: string | null;
  orientation: string;
};

type AdOption = {
  id: string;
  title: string;
  durationSeconds: number;
  advertiserName: string | null;
};

export function ScreenRowActions({
  screen,
  ads,
  currentAdIds,
}: {
  screen: ScreenRow;
  ads: AdOption[];
  currentAdIds: string[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, startRegenerate] = useTransition();

  function handleRegenerate() {
    startRegenerate(async () => {
      const result = await regenerateScreenPlaylist(screen.id);
      setRegenerateMessage(result.message);
      setTimeout(() => setRegenerateMessage(null), 6000);
    });
  }

  return (
    <div className="relative inline-block">
      {regenerateMessage && (
        <div className="absolute top-full right-0 z-10 mt-1 w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
          {regenerateMessage}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal />
              <span className="sr-only">Ações</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setConnectionOpen(true)}>
            <Wifi />
            Verificar conexão
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPlaylistOpen(true)}>
            <ListVideo />
            Playlist
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isRegenerating} onClick={handleRegenerate}>
            <RefreshCw className={isRegenerating ? "animate-spin" : ""} />
            Gerar playlist automaticamente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => unpairScreen(screen.id))}
          >
            <Unlink />
            Desparear
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditScreenDialog screen={screen} open={editOpen} onOpenChange={setEditOpen} />
      <ScreenPlaylistDialog
        screen={screen}
        ads={ads}
        currentAdIds={currentAdIds}
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
      />
      <ScreenConnectionDialog
        screen={screen}
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
      />
    </div>
  );
}
