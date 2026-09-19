import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderPage({
  title,
  description,
  roadmapPhase,
}: {
  title: string;
  description: string;
  roadmapPhase: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Em construção</CardTitle>
          <CardDescription>
            Esta tela será implementada em {roadmapPhase} (ver docs/PROJECT_BRIEF.md,
            seção 10 — Roadmap).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Estrutura de rota e navegação já disponíveis; falta a implementação funcional.
        </CardContent>
      </Card>
    </div>
  );
}
