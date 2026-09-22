"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { pairScreen } from "./actions";
import { ORIENTATION_LABELS } from "./orientation-labels";

export function PairScreenDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await pairScreen({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Parear tela
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parear tela</DialogTitle>
          <DialogDescription>
            Digite o código de 6 dígitos exibido em tela cheia no player.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pairingCode">Código de pareamento</Label>
            <Input
              id="pairingCode"
              name="pairingCode"
              placeholder="000000"
              className="font-mono text-lg tracking-[0.3em]"
              maxLength={6}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Nome da tela</Label>
            <Input id="name" name="name" placeholder="Ex.: Recepção — 1º andar" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Local (opcional)</Label>
            <Input id="location" name="location" placeholder="Ex.: Loja Centro" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orientation">Orientação</Label>
            <Select name="orientation" defaultValue="0">
              <SelectTrigger id="orientation" className="w-full">
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
              {isPending ? "Pareando..." : "Parear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
