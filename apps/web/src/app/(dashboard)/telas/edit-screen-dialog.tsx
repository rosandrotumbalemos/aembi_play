"use client";

import { useTransition } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateScreen } from "./actions";
import { ORIENTATION_LABELS } from "./orientation-labels";

export function EditScreenDialog({
  screen,
  open,
  onOpenChange,
}: {
  screen: { id: string; name: string; location: string | null; orientation: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateScreen({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setError(undefined);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tela</DialogTitle>
          <DialogDescription>Nome, local e orientação da tela.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={screen.id} />
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nome da tela</Label>
            <Input id="edit-name" name="name" defaultValue={screen.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-location">Local (opcional)</Label>
            <Input
              id="edit-location"
              name="location"
              defaultValue={screen.location ?? ""}
              placeholder="Ex.: Loja Centro"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-orientation">Orientação</Label>
            <Select name="orientation" defaultValue={screen.orientation}>
              <SelectTrigger id="edit-orientation" className="w-full">
                {/* SelectValue não resolve o rótulo a partir dos SelectItem
                    filhos nesta versão do Base UI (mostraria só "0", "90"
                    etc.) — mapeamos manualmente. */}
                <SelectValue>{(value: string | null) => ORIENTATION_LABELS[value ?? "0"]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{ORIENTATION_LABELS["0"]}</SelectItem>
                <SelectItem value="90">{ORIENTATION_LABELS["90"]}</SelectItem>
                <SelectItem value="180">{ORIENTATION_LABELS["180"]}</SelectItem>
                <SelectItem value="270">{ORIENTATION_LABELS["270"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
