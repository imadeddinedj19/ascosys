/** Logo / marque AscoSys — icône « arc-reactor » façon JARVIS. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-primary/50" />
        <span
          className="absolute inset-1 rounded-full border border-primary/30"
          style={{ animation: "pulse-ring 3s ease-in-out infinite" }}
        />
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_2px_rgba(34,211,238,0.8)]" />
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-wide text-foreground">
          Asco<span className="text-primary text-glow">Sys</span>
        </span>
      )}
    </div>
  );
}
