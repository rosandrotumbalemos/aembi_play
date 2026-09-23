const STATUS_STYLES = {
  online: { dot: "bg-success", text: "text-success", bg: "bg-success/12", label: "Online" },
  sem_sinal: { dot: "bg-warning", text: "text-warning", bg: "bg-warning/14", label: "Sem sinal" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-[3px] text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
