"use client";

import { SpeakButton } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import type { WritingErrorType } from "@/lib/writing/schema";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Dumbbell,
  Ear,
  Loader2,
  PenLine,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Attempt } from "../types";
import { formatDate, formatDictees, score100Bar, score100Classes } from "./shared";

const ERROR_STYLES: Record<WritingErrorType, { label: string; mark: string; badge: string }> = {
  orthographe: { label: "Orthographe", mark: "decoration-rose-500 bg-rose-50", badge: "bg-rose-100 text-rose-700" },
  grammaire: { label: "Grammaire", mark: "decoration-violet-500 bg-violet-50", badge: "bg-violet-100 text-violet-700" },
  conjugaison: { label: "Conjugaison", mark: "decoration-amber-500 bg-amber-50", badge: "bg-amber-100 text-amber-800" },
  vocabulaire: { label: "Vocabulaire", mark: "decoration-sky-500 bg-sky-50", badge: "bg-sky-100 text-sky-700" },
  ponctuation: { label: "Ponctuation", mark: "decoration-gray-500 bg-gray-100", badge: "bg-gray-200 text-gray-700" },
};

const SCORE_LABELS = [
  ["spelling", "Orthographe"],
  ["grammar", "Grammaire"],
  ["conjugation", "Conjugaison"],
  ["vocabulary", "Vocabulaire"],
] as const;

type View = "copy" | "corrected" | "improved";

/** Step 3 — the corrected attempt: scores, highlighted errors, improved version, exercises. */
export function AttemptView({
  attempt,
  onNewAttempt,
}: {
  attempt: Attempt;
  /** dictation: re-write it while listening to the improved version */
  onNewAttempt: (dictation: boolean) => void;
}) {
  const router = useRouter();
  const c = attempt.correction;
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<View>("copy");
  const [practicing, setPracticing] = useState<number | null>(null);

  const practice = async (index: number) => {
    setPracticing(index);
    try {
      const res = await fetch(`/api/writing/attempts/${attempt.id}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/exercices/sessions/${data.sessionId}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Les exercices n'ont pas pu être préparés");
      setPracticing(null);
    }
  };

  const located = new Set(c.segments.filter((s) => s.error != null).map((s) => s.error));
  const selectedError = selected != null ? c.errors[selected] : null;

  return (
    <div className="space-y-5">
      {/* Scores */}
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-xs md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-1 md:px-6">
          <span className={cn("rounded-2xl px-5 py-3 text-4xl font-bold tabular-nums", score100Classes(attempt.scores.global))}>
            {attempt.scores.global}
            <span className="text-lg font-semibold">/100</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Essai n°{attempt.number} · {formatDate(attempt.created_at)}
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {attempt.word_count} mots · vaut {formatDictees(attempt.dictee_value)}
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex gap-1 text-gray-800">
            <p className="flex-1">{c.greeting}</p>
            <SpeakButton text={c.greeting} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCORE_LABELS.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold tabular-nums">{attempt.scores[key]}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={cn("h-full rounded-full", score100Bar(attempt.scores[key]))} style={{ width: `${attempt.scores[key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The text, three ways */}
      <div className="rounded-2xl bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          {(
            [
              ["copy", `Ma copie (${c.errors.length} erreur${c.errors.length > 1 ? "s" : ""})`],
              ["corrected", "Copie corrigée"],
              ["improved", "Version améliorée"],
            ] as [View, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                view === key ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "copy" && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-lg leading-loose text-gray-900">
              {c.segments.map((s, i) => {
                if (s.error == null) return <span key={i}>{s.text}</span>;
                const error = c.errors[s.error];
                const style = ERROR_STYLES[error.type] ?? ERROR_STYLES.orthographe;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(s.error === selected ? null : s.error)}
                    className={cn(
                      "rounded px-0.5 underline decoration-wavy decoration-2 underline-offset-4 transition-colors",
                      style.mark,
                      selected === s.error && "ring-2 ring-offset-1 ring-sky-400"
                    )}
                    title={`${style.label} : ${error.correction}`}
                  >
                    {s.text}
                  </button>
                );
              })}
            </p>
            {selectedError && <ErrorCard error={selectedError} />}
            {c.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Toutes mes erreurs</h3>
                <ol className="space-y-2">
                  {c.errors.map((e, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setSelected(i)}
                        className={cn("w-full text-left", !located.has(i) && "cursor-default")}
                      >
                        <ErrorCard error={e} compact active={selected === i} />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {view === "corrected" && (
          <p className="whitespace-pre-wrap text-lg leading-loose text-gray-900">{attempt.corrected_text}</p>
        )}

        {view === "improved" && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-lg leading-loose text-gray-900">{attempt.improved_text}</p>
            {c.improvements.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Wand2 className="size-4 text-violet-600" /> Comment ton texte a été enrichi
                </h3>
                {c.improvements.map((imp, i) => (
                  <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-sm">
                    <p>
                      <span className="text-gray-500 line-through decoration-gray-400">{imp.original}</span>
                      <ArrowRight className="mx-1.5 inline size-3.5 text-violet-500" />
                      <span className="font-medium text-violet-900">{imp.improved}</span>
                    </p>
                    <p className="mt-1 text-gray-700">{imp.why}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strengths, weaknesses, exercises */}
      <div className="grid gap-4 md:grid-cols-2">
        <FeedbackList icon={ThumbsUp} title="Ce que tu as bien réussi" items={c.strengths} className="border-green-200 bg-green-50 text-green-900" />
        <FeedbackList icon={ThumbsDown} title="Ce qui est moins réussi" items={c.weaknesses} className="border-amber-200 bg-amber-50 text-amber-900" />
      </div>
      {c.outline_feedback && (
        <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{c.outline_feedback}</p>
        </div>
      )}

      {c.to_work.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-xs">
          <h3 className="flex items-center gap-1.5 font-semibold text-gray-900">
            <Dumbbell className="size-4 text-sky-600" /> À travailler
          </h3>
          <p className="text-sm text-muted-foreground">
            Avant ton prochain essai, entraîne-toi sur ces points avec des exercices préparés à partir de tes erreurs.
          </p>
          <div className="space-y-2">
            {c.to_work.map((point, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <span className="font-medium text-gray-800">{point.label}</span>
                <Button size="sm" variant="secondary" onClick={() => practice(i)} disabled={practicing != null}>
                  {practicing === i ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}
                  {practicing === i ? "Préparation (≈ 1 min)…" : attempt.training_sheets[String(i)] ? "Refaire des exercices" : "S'entraîner"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onNewAttempt(false)}>
          <PenLine className="size-4" /> Nouvel essai
        </Button>
        <Button variant="outline" onClick={() => onNewAttempt(true)}>
          <Ear className="size-4" /> Réécrire la version améliorée en dictée
        </Button>
      </div>
    </div>
  );
}

function ErrorCard({
  error,
  compact,
  active,
}: {
  error: Attempt["correction"]["errors"][number];
  compact?: boolean;
  active?: boolean;
}) {
  const style = ERROR_STYLES[error.type] ?? ERROR_STYLES.orthographe;
  return (
    <div className={cn("rounded-lg border p-3 text-sm transition-colors", active ? "border-sky-400 bg-sky-50/50" : "bg-white", !compact && "border-sky-300 shadow-xs")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", style.badge)}>{style.label}</span>
        <span className="text-rose-700 line-through">{error.wrong}</span>
        <ArrowRight className="size-3.5 text-gray-400" />
        <span className="font-semibold text-green-700">{error.correction}</span>
      </div>
      <div className="mt-1 flex gap-1 text-gray-700">
        <p className="flex-1">{error.explanation}</p>
        {!compact && <SpeakButton text={error.explanation} className="-my-1" />}
      </div>
    </div>
  );
}

function FeedbackList({
  icon: Icon,
  title,
  items,
  className,
}: {
  icon: typeof ThumbsUp;
  title: string;
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("rounded-xl border p-4 text-sm", className)}>
      <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
        <Icon className="size-4" /> {title}
      </h3>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
