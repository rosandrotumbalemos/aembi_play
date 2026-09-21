"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "./actions";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => startTransition(() => deleteCategory(id))}
    >
      <Trash2 />
      <span className="sr-only">Remover</span>
    </Button>
  );
}
