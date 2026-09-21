"use client";

import { useState, useTransition } from "react";
import { ListVideo, MoreHorizontal, Pencil, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditScreenDialog } from "./edit-screen-dialog";
import { ScreenPlaylistDialog } from "./screen-playlist-dialog";
import { unpairScreen } from "./actions";

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
  const [isPending, startTransition] = useTransition();

  return (
    <>
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
          <DropdownMenuItem onClick={() => setPlaylistOpen(true)}>
            <ListVideo />
            Playlist
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
    </>
  );
}
