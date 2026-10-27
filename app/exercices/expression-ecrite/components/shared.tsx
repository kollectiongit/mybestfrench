"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

/** Markdown of the coach's messages and of the outline (bold, lists). */
export function RichMd({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("space-y-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5", className)}>
      <ReactMarkdown allowedElements={["p", "strong", "em", "br", "ol", "ul", "li"]} unwrapDisallowed>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Colors of a score out of 100. */
export function score100Classes(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-sky-100 text-sky-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function score100Bar(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-sky-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function formatDictees(value: number) {
  const n = value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${n} dictée${value >= 2 ? "s" : ""}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
