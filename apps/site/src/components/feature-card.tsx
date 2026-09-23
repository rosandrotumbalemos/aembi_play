import type { LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-panel p-6">
      <div className="flex size-10 items-center justify-center rounded-[10px] bg-primary/14 text-primary">
        <Icon className="size-[22px]" strokeWidth={1.8} />
      </div>
      <div className="text-[17px] font-semibold">{title}</div>
      <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
    </div>
  );
}
