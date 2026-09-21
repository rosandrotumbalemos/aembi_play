"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory } from "./actions";

export function NewCategoryForm() {
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCategory({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="Nome da categoria" required className="max-w-xs" />
        <Button type="submit" disabled={isPending}>
          <Plus />
          {isPending ? "Salvando..." : "Adicionar"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
