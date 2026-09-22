"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCampaign } from "./actions";

type Advertiser = { id: string; name: string };
type AdOption = { id: string; title: string; advertiserId: string; durationSeconds: number };
type Plan = { id: string; name: string; maxScreens: number };
type ScreenOption = { id: string; name: string; location: string | null };

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function NewCampaignDialog({
  advertisers,
  ads,
  plans,
  screens,
}: {
  advertisers: Advertiser[];
  ads: AdOption[];
  plans: Plan[];
  screens: ScreenOption[];
}) {
  const [open, setOpen] = useState(false);
  const [advertiserId, setAdvertiserId] = useState("");
  const [adId, setAdId] = useState("");
  const [planId, setPlanId] = useState("");
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeWindowStart, setTimeWindowStart] = useState("");
  const [timeWindowEnd, setTimeWindowEnd] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(ALL_DAYS);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const adsForAdvertiser = useMemo(
    () => ads.filter((ad) => ad.advertiserId === advertiserId),
    [ads, advertiserId],
  );
  const selectedPlan = plans.find((plan) => plan.id === planId);

  function reset() {
    setAdvertiserId("");
    setAdId("");
    setPlanId("");
    setScreenIds([]);
    setStartDate("");
    setEndDate("");
    setTimeWindowStart("");
    setTimeWindowEnd("");
    setDaysOfWeek(ALL_DAYS);
    setError(undefined);
  }

  function toggleScreen(screenId: string, checked: boolean) {
    setScreenIds((prev) => (checked ? [...prev, screenId] : prev.filter((id) => id !== screenId)));
  }

  function toggleDay(day: number, checked: boolean) {
    setDaysOfWeek((prev) =>
      checked ? [...prev, day].sort((a, b) => a - b) : prev.filter((d) => d !== day),
    );
  }

  function handleSubmit() {
    setError(undefined);
    startTransition(async () => {
      const result = await createCampaign({
        advertiserId,
        adId,
        planId,
        screenIds,
        startDate,
        endDate,
        timeWindowStart,
        timeWindowEnd,
        daysOfWeek,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Nova campanha
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            Anunciante → anúncio → telas → validade → plano.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Anunciante *</Label>
            <Select
              value={advertiserId}
              onValueChange={(value) => {
                setAdvertiserId(value ?? "");
                setAdId("");
              }}
            >
              <SelectTrigger className="w-full">
                {/* SelectValue não resolve o rótulo sozinho a partir dos
                    SelectItem filhos nesta versão do Base UI (mostraria o
                    id cru) — resolvemos manualmente a partir da lista já
                    carregada. */}
                <SelectValue>
                  {(value: string | null) =>
                    advertisers.find((a) => a.id === value)?.name ?? "Selecione o anunciante"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {advertisers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum anunciante cadastrado.
                  </div>
                ) : (
                  advertisers.map((advertiser) => (
                    <SelectItem key={advertiser.id} value={advertiser.id}>
                      {advertiser.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Anúncio *</Label>
            <Select
              value={adId}
              onValueChange={(value) => setAdId(value ?? "")}
              disabled={!advertiserId}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    adsForAdvertiser.find((ad) => ad.id === value)?.title ??
                    (advertiserId ? "Selecione o anúncio" : "Selecione o anunciante primeiro")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {adsForAdvertiser.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum anúncio publicado desse anunciante.
                  </div>
                ) : (
                  adsForAdvertiser.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id}>
                      {ad.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Telas *</Label>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2">
              {screens.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  Nenhuma tela pareada ainda — pareie uma tela em Telas primeiro.
                </p>
              ) : (
                screens.map((screen) => (
                  <label
                    key={screen.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={screenIds.includes(screen.id)}
                      onCheckedChange={(value) => toggleScreen(screen.id, value === true)}
                    />
                    <span className="flex-1">{screen.name}</span>
                    {screen.location && (
                      <span className="text-xs text-muted-foreground">{screen.location}</span>
                    )}
                  </label>
                ))
              )}
            </div>
            {selectedPlan && screenIds.length > selectedPlan.maxScreens && (
              <p className="text-xs text-destructive">
                O plano "{selectedPlan.name}" permite no máximo {selectedPlan.maxScreens}{" "}
                tela(s).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Início *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Fim *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Faixa de horário diária (opcional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="time"
                aria-label="Início da faixa de horário"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
              />
              <Input
                type="time"
                aria-label="Fim da faixa de horário"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para exibir em qualquer horário do dia.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Dias da semana *</Label>
            <div className="flex flex-wrap gap-3">
              {DAY_LABELS.map((label, day) => (
                <label key={day} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={daysOfWeek.includes(day)}
                    onCheckedChange={(value) => toggleDay(day, value === true)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {daysOfWeek.length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos um dia.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Plano *</Label>
            <Select value={planId} onValueChange={(value) => setPlanId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    plans.find((plan) => plan.id === value)?.name ?? "Selecione o plano"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {plans.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum plano cadastrado — crie um em Planos primeiro.
                  </div>
                ) : (
                  plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isPending || daysOfWeek.length === 0}>
            {isPending ? "Salvando..." : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
