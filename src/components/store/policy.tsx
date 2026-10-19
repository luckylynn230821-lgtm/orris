import { StoreShell } from "@/components/store/shell";

export function PolicyPage({
  kicker,
  title,
  sections,
}: {
  kicker: string;
  title: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="text-xs tracking-[0.2em] text-ash uppercase">{kicker}</p>
        <h1 className="mt-3 text-5xl tracking-[-0.04em]">{title}</h1>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl tracking-[-0.03em]">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/85">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
    </StoreShell>
  );
}
