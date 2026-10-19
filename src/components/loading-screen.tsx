import { useT } from "@/lib/i18n/provider";

function Mark({ tone }: { tone: "shop" | "desk" }) {
  const { t } = useT();
  return (
    <div className={tone === "desk" ? "desk grid min-h-screen place-items-center bg-stone text-ink" : "grid min-h-screen place-items-center bg-ivory text-ink"}>
      <div className="flex flex-col items-center">
        <div className="relative size-14">
          <span className="absolute inset-0 rounded-full border border-line" />
          <span className="desk-spin absolute inset-0 rounded-full border-2 border-transparent border-t-ink" />
        </div>
        <p className="mt-5 text-sm tracking-[0.2em]">{t("desk.pleaseWait")}</p>
      </div>
    </div>
  );
}

export function PageLoading() {
  return <Mark tone="shop" />;
}

export function DeskLoading() {
  return <Mark tone="desk" />;
}
