"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createPlan } from "./actions";

export function NewPlanDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPlan({}, formData);
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
            Novo plano
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>
            Define quanto espaço uma campanha desse plano ocupa no loop de cada tela.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required autoFocus placeholder="Ex.: Plano Bronze" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="insertionsPerCycle">Inserções/ciclo *</Label>
              <Input
                id="insertionsPerCycle"
                name="insertionsPerCycle"
                type="number"
                min={1}
                step={1}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxDurationSeconds">Duração máx. (s) *</Label>
              <Input
                id="maxDurationSeconds"
                name="maxDurationSeconds"
                type="number"
                min={1}
                step={1}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxScreens">Limite de telas *</Label>
              <Input id="maxScreens" name="maxScreens" type="number" min={1} step={1} required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Faixa de horário nobre (opcional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="timeWindowStart"
                type="time"
                aria-label="Início da faixa de horário"
              />
              <Input name="timeWindowEnd" type="time" aria-label="Fim da faixa de horário" />
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para não restringir por horário.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox name="primeTimeAccess" />
            Acesso a horário nobre
          </label>
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
