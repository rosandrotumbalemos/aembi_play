"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAdvertiser } from "./actions";

export function NewAdvertiserDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createAdvertiser({}, formData);
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
        if (!next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Novo anunciante
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo anunciante</DialogTitle>
          <DialogDescription>
            Cadastre o anunciante antes de subir os anúncios dele na Biblioteca.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="document">CNPJ/CPF</Label>
              <Input id="document" name="document" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
