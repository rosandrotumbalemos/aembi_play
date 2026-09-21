"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Envolve o card do anúncio: clicar abre um modal tocando o vídeo original
 * (proxy autenticado em /api/ads/[id]/video — mesma lógica "servidor no
 * meio" da miniatura). Cada card controla seu próprio modal, sem estado
 * compartilhado na página.
 */
export function AdPreviewTrigger({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-pointer text-left"
        aria-label={`Reproduzir ${title}`}
      >
        {children}
      </button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <video
            key={id}
            src={`/api/ads/${id}/video`}
            controls
            autoPlay
            className="aspect-video w-full rounded-md bg-black"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
