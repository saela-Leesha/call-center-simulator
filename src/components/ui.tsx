import type { ReactNode } from "react";
import { cn, scoreTone } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "teal" | "navy" | "gold" | "rose" | "slate";
}) {
  const tones = {
    teal: "from-accent/20 to-white",
    navy: "from-navy/10 to-white",
    gold: "from-gold/25 to-white",
    rose: "from-rose-100 to-white",
    slate: "from-slate-100 to-white",
  };
  return (
    <article className={cn("rounded-2xl border border-line bg-gradient-to-br p-5 shadow-sm", tones[tone])}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </article>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "ok" | "warn" | "danger" | "teal" | "navy";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    ok: "bg-emerald-50 text-ok",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-danger",
    teal: "bg-teal-50 text-accent-2",
    navy: "bg-navy/10 text-navy",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", map[tone])}>
      {children}
    </span>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  const color =
    tone === "excellent"
      ? "bg-ok"
      : tone === "good"
        ? "bg-accent-2"
        : tone === "fair"
          ? "bg-gold"
          : "bg-danger";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
