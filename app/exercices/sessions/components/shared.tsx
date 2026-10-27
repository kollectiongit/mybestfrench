"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

/** Inline markdown (bold/italic) rendered without wrapping <p>. */
export function Md({ children, className }: { children: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        allowedElements={["p", "strong", "em", "br"]}
        unwrapDisallowed
        components={{ p: ({ children }) => <>{children}</> }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

export function Feedback({
  correct,
  title,
  children,
  className,
}: {
  correct: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2 text-sm",
        correct
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900",
        className
      )}
    >
      {correct ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
      )}
      <div className="space-y-0.5">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export const MARK_COLORS = {
  red: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-500", dot: "bg-rose-500" },
  green: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-500", dot: "bg-emerald-500" },
  blue: { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-500", dot: "bg-sky-500" },
  orange: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500", dot: "bg-amber-500" },
  purple: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-500", dot: "bg-violet-500" },
} as const;

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function scoreClasses(score20: number | null) {
  if (score20 == null) return "bg-gray-100 text-gray-600";
  if (score20 >= 16) return "bg-emerald-100 text-emerald-700";
  if (score20 >= 12) return "bg-sky-100 text-sky-700";
  if (score20 >= 8) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function formatScore(score20: number) {
  return score20.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function SkillBar({ label, correct, total }: { label: string; correct: number; total: number }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const color = !total
    ? "bg-gray-300"
    : pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {total ? `${pct} % · ${correct}/${total}` : "pas encore travaillé"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
