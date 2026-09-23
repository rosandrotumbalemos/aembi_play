import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/14 px-3.5 py-1.5 font-mono text-[13px] font-medium text-[#b3a8ff]">
      {children}
    </span>
  );
}
