import { cn } from "@/lib/cn";

/** Original wordmark: a bowl curve and one ear. Not a paw, bone, or heart. */
export function Mark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <path
          d="M5.5 15.5c2.2 7.2 18.8 7.2 21 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M15.2 9.2c.4 2.4 2 3.5 3.8 3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-[1.65rem] leading-none tracking-[-0.05em]">{name}</span>
    </span>
  );
}
