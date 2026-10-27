"use client";

import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { cn } from "@/lib/utils";
import { Archive, ChevronLeft, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LessonView } from "../../components/lesson-view";
import { Preparing, startSession } from "../../components/preparing";
import { formatDuration, formatScore, scoreClasses, SkillBar } from "../../components/shared";
import type { Lesson, Skill, SkillsResult } from "../../types";

interface SheetDetail {
  sheet: {
    id: number;
    title: string;
    source_type: string;
    source_images: string[];
    source_text: string | null;
    lesson: Lesson;
    skills: Skill[];
    category: { id: number; name: string };
    topic: { id: number; name: string };
  };
  mastery: SkillsResult;
  sessions: {
    id: string;
    status: string;
    started_at: string;
    active_seconds: number;
    score_20: number | null;
    items_total: number;
    items_correct: number;
  }[];
}

export default function SheetClient({ sheetId }: { sheetId: number }) {
  const router = useRouter();
  const { profile } = useCurrentProfile();
  const [data, setData] = useState<SheetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    fetch(`/api/training/sheets/${sheetId}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Erreur");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [sheetId, profile?.id]);

  const start = async () => {
    setStarting(true);
    try {
      const id = await startSession(sheetId);
      router.push(`/exercices/sessions/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setStarting(false);
    }
  };

  const archive = async () => {
    if (!confirm("Archiver cette fiche ? Elle n'apparaîtra plus dans la liste (l'historique est conservé).")) return;
    const res = await fetch(`/api/training/sheets/${sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (res.ok) router.push("/exercices/sessions");
    else toast.error("Erreur lors de l'archivage");
  };

  if (error) return <div className="container mx-auto px-4 py-12 text-center text-gray-500">{error}</div>;
  if (!data) return <Preparing message="Chargement de la fiche…" />;
  if (starting) {
    return (
      <Preparing
        message="Le prof prépare tes exercices…"
        hint="Des questions nouvelles, adaptées à ce que tu as déjà réussi ou pas. Cela prend environ 30 secondes."
      />
    );
  }

  const { sheet, mastery, sessions } = data;
  const inProgress = sessions.find((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <Link href="/exercices/sessions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Exercices
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {sheet.category.name} › {sheet.topic.name}
            </div>
            <h1 className="text-3xl font-bold">{sheet.title}</h1>
          </div>
          <div className="flex gap-2">
            {inProgress ? (
              <Button asChild className="gap-2">
                <Link href={`/exercices/sessions/${inProgress.id}`}>
                  <Play className="size-4" /> Reprendre la session
                </Link>
              </Button>
            ) : (
              <Button className="gap-2" onClick={start}>
                {completed.length ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
                {completed.length ? "Nouvelle session" : "Commencer"}
              </Button>
            )}
            <Button variant="outline" size="icon" title="Archiver la fiche" onClick={archive}>
              <Archive className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-3 rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Ma maîtrise</h2>
          {sheet.skills.map((s) => (
            <SkillBar key={s.id} label={s.label} correct={mastery[s.id]?.correct ?? 0} total={mastery[s.id]?.total ?? 0} />
          ))}
        </div>
        <div className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Historique</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune session pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/exercices/sessions/${s.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-gray-50">
                    <span>
                      {new Date(s.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      <span className="ml-2 text-muted-foreground">{formatDuration(s.active_seconds)}</span>
                    </span>
                    {s.status === "completed" && s.score_20 != null ? (
                      <span className={cn("rounded-full px-2 py-0.5 font-bold tabular-nums", scoreClasses(s.score_20))}>
                        {formatScore(s.score_20)}/20
                      </span>
                    ) : (
                      <span className="text-xs text-sky-700">en cours</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <LessonView lesson={sheet.lesson} />

      {(sheet.source_images.length > 0 || sheet.source_text) && (
        <details className="rounded-2xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">Source de la fiche</summary>
          <div className="mt-3 space-y-3">
            {sheet.source_text && <p className="whitespace-pre-wrap text-sm text-gray-700">{sheet.source_text}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {sheet.source_images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img} src={`/api/images/${img}`} alt="Page du cahier" className="rounded-lg border" />
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
