import { useEffect, useState } from "react";
import { adminAnalytics } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";
import type { RangeKey } from "@/lib/commerce/metrics";

const RANGE_IDS: RangeKey[] = ["today", "yesterday", "7d", "30d", "month", "last_month", "year"];

export function useAnalytics(range: RangeKey, includeDemo: boolean) {
  const { tx } = useT();
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
        setError(err instanceof Error ? tx(err.message) : tx("admin.booksFailed"));
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
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_IDS.map((id) => (
        <button
          key={id}
          onClick={() => setRange(id)}
          className={range === id ? "h-9 bg-ink px-3 text-xs text-ivory" : "h-9 border border-line bg-paper px-3 text-xs"}
        >
          {t(`range.${id}` as MessageKey)}
        </button>
      ))}
      <label className="ml-auto flex items-center gap-2 text-xs text-ash">
        <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
        {t("admin.includeSample")}
      </label>
    </div>
  );
}
