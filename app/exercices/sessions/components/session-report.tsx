"use client";

import { SpeakButton } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, RotateCcw, Sparkles, Target, ThumbsUp } from "lucide-react";
import Link from "next/link";
import type { SessionData } from "../types";
import { formatDuration, formatScore, Md, scoreClasses, SkillBar } from "./shared";

export function SessionReportView({
  session,
  onRestart,
  restarting,
}: {
  session: SessionData;
  onRestart: () => void;
  restarting: boolean;
}) {
  const report = session.report;
  const score = session.score_20 ?? report?.score_20 ?? 0;
  const skills = session.sheet.skills;
  const results = session.skills_result ?? {};
  const extraSkillIds = Object.keys(results).filter((id) => !skills.some((s) => s.id === id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
        <div className={cn("flex size-28 shrink-0 flex-col items-center justify-center rounded-full", scoreClasses(score))}>
          <span className="text-4xl font-bold tabular-nums">{formatScore(score)}</span>
          <span className="text-sm font-medium">/ 20</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Bilan de la session</h2>
          {report?.message && (
            <p className="text-gray-700">
              <Md>{report.message}</Md>
              <SpeakButton
                className="ml-1"
                text={[report.message, ...report.compris, ...report.a_revoir, report.conseil].join(". ")}
                label="Écouter le bilan"
              />
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {formatDuration(session.active_seconds)}
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="size-4" /> {session.items_correct} / {session.items_total} réponses justes
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-green-900">
            <ThumbsUp className="size-4" /> Ce que tu as compris
          </h3>
          {report?.compris.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-green-950">
              {report.compris.map((c, i) => (
                <li key={i}>
                  <Md>{c}</Md>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-900/70">Pas encore de compétence acquise : on continue !</p>
          )}
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
            <RotateCcw className="size-4" /> À revoir
          </h3>
          {report?.a_revoir.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
              {report.a_revoir.map((c, i) => (
                <li key={i}>
                  <Md>{c}</Md>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-amber-900/70">Rien à revoir, tout est réussi !</p>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-white p-4">
        <h3 className="font-semibold">Résultats par compétence</h3>
        {skills.map((s) => (
          <SkillBar key={s.id} label={s.label} correct={results[s.id]?.correct ?? 0} total={results[s.id]?.total ?? 0} />
        ))}
        {extraSkillIds.map((id) => (
          <SkillBar key={id} label="Divers" correct={results[id].correct} total={results[id].total} />
        ))}
      </div>

      {report?.conseil && (
        <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-sky-600" />
          <div>
            <div className="font-semibold">Pour la prochaine fois</div>
            <Md>{report.conseil}</Md>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onRestart} disabled={restarting} className="gap-2">
          <RotateCcw className="size-4" /> Nouvelle session (nouvelles questions)
        </Button>
        <Button asChild variant="outline">
          <Link href={`/exercices/sessions/fiche/${session.sheet.id}`}>Retour à la fiche</Link>
        </Button>
      </div>
    </div>
  );
}
