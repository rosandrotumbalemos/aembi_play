"use client";

import { useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCampaignActive } from "./actions";

export function CampaignRowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={isPending}
      onClick={() => startTransition(() => setCampaignActive(id, !active))}
      title={active ? "Pausar campanha" : "Reativar campanha"}
    >
      {active ? <Pause /> : <Play />}
      <span className="sr-only">{active ? "Pausar" : "Reativar"}</span>
    </Button>
  );
}
