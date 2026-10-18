import { useEffect, useState } from "react";
import { adminAnalytics } from "@/lib/commerce/fns";
import type { RangeKey } from "@/lib/commerce/metrics";

export const RANGES: { id: RangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "year", label: "This year" },
];

export function useAnalytics(range: RangeKey, includeDemo: boolean) {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAnalytics>> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    void adminAnalytics({ data: { range, includeDemo } })
      .then((next) => {
        if (!live) return;
        setData(next);
        setError("");
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Could not load the books");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [range, includeDemo]);
  return { data, error, loading };
}

export function RangeBar({
  range,
  setRange,
  includeDemo,
  setIncludeDemo,
}: {
  range: RangeKey;
  setRange: (range: RangeKey) => void;
  includeDemo: boolean;
  setIncludeDemo: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGES.map((item) => (
        <button
          key={item.id}
          onClick={() => setRange(item.id)}
          className={range === item.id ? "h-9 bg-ink px-3 text-xs text-ivory" : "h-9 border border-line bg-paper px-3 text-xs"}
        >
          {item.label}
        </button>
      ))}
      <label className="ml-auto flex items-center gap-2 text-xs text-ash">
        <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
        Include sample history
      </label>
    </div>
  );
}
