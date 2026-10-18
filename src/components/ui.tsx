import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "text" }) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 px-5 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-ink text-ivory hover:bg-ink/85",
        variant === "ghost" && "border border-line bg-paper text-ink hover:bg-stone",
        variant === "text" && "h-auto px-0 text-ink underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{label}</span>
      <input
        className="h-11 w-full border border-line bg-paper px-3 text-ink outline-none focus:border-ink"
        {...props}
      />
    </label>
  );
}

export function Photo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={cn("h-full w-full bg-stone object-cover", className)} />;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("border border-line bg-paper", className)}>{children}</section>;
}
