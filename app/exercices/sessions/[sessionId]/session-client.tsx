"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Flag,
  Pause,
  Play,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LessonView } from "../components/lesson-view";
import { Preparing, startSession } from "../components/preparing";
import { SessionReportView } from "../components/session-report";
import { formatDuration, Md } from "../components/shared";
import { ExerciseWidget } from "../components/widgets";
import type { ItemResult, SessionData, SessionExercise } from "../types";

const HEARTBEAT_SECONDS = 15;

const TYPE_LABELS: Record<SessionExercise["type"], string> = {
  choice: "QCM",
  fill_blanks: "Texte à trous",
  mark_words: "Souligne",
  classify: "Classement",
  label: "Étiquettes",
};

function isDone(e: SessionExercise) {
  return e.status === "done";
}

export default function SessionClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const secondsRef = useRef(0);
  const lastSentRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/training/sessions/${sessionId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      const s: SessionData = data.session;
      setSession(s);
      setSeconds(s.active_seconds);
      secondsRef.current = s.active_seconds;
      lastSentRef.current = s.active_seconds;
      const firstOpen = s.exercises.findIndex((e) => !isDone(e));
      setIndex(firstOpen === -1 ? s.exercises.length - 1 : firstOpen);
      setStarted(s.exercises.some((e) => Object.keys(e.answers).length > 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const inProgress = session?.status === "in_progress";
  const running = inProgress && started && !paused && !completing;

  const sendHeartbeat = useCallback(
    (keepalive = false) => {
      if (secondsRef.current <= lastSentRef.current) return;
      lastSentRef.current = secondsRef.current;
      fetch(`/api/training/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_seconds: secondsRef.current }),
        keepalive,
      }).catch(() => {});
    },
    [sessionId]
  );

  // Chronomètre : ne compte que quand la page est visible et pas en pause
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current - lastSentRef.current >= HEARTBEAT_SECONDS) sendHeartbeat();
    }, 1000);
    return () => clearInterval(id);
  }, [running, sendHeartbeat]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") sendHeartbeat(true);
    };
    const onPageHide = () => sendHeartbeat(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      sendHeartbeat(true);
    };
  }, [sendHeartbeat]);

  const answer = useCallback(
    async (exerciseId: number, itemKey: string, value: unknown) => {
      const res = await fetch(`/api/training/exercises/${exerciseId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: itemKey, answer: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la correction");
        return;
      }
      setSession((s) =>
        s && {
          ...s,
          exercises: s.exercises.map((e) =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  ...data.exercise,
                  answers: {
                    ...e.answers,
                    [itemKey]: { answer: value, result: data.result as ItemResult },
                  },
                }
          ),
        }
      );
    },
    []
  );

  const complete = async () => {
    setCompleting(true);
    sendHeartbeat();
    try {
      const res = await fetch(`/api/training/sessions/${sessionId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSession(data.session);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCompleting(false);
    }
  };

  const restart = async () => {
    if (!session) return;
    setRestarting(true);
    try {
      const id = await startSession(session.sheet.id);
      router.push(`/exercices/sessions/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setRestarting(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 text-center text-gray-500">{error}</div>
    );
  }
  if (!session) {
    return <Preparing message="Chargement de la session…" />;
  }
  if (restarting) {
    return (
      <Preparing
        message="Le prof prépare de nouveaux exercices…"
        hint="Les questions sont nouvelles et tiennent compte de ce qui était à revoir. Cela prend environ 30 secondes."
      />
    );
  }

  const exercises = session.exercises;
  const current = exercises[index];
  const allDone = exercises.every(isDone);
  const answeredUnits = exercises.reduce(
    (n, e) => n + Object.values(e.answers).reduce((m, a) => m + a.result.units.length, 0),
    0
  );
  const correctUnits = exercises.reduce(
    (n, e) => n + Object.values(e.answers).reduce((m, a) => m + a.result.units.filter((u) => u.correct).length, 0),
    0
  );

  const lessonButton = (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <BookOpen className="size-4" /> Leçon
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{session.sheet.title}</DialogTitle>
        </DialogHeader>
        <LessonView lesson={session.sheet.lesson} />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* En-tête */}
      <div className="space-y-3">
        <Link
          href={`/exercices/sessions/fiche/${session.sheet.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {session.sheet.category} › {session.sheet.topic}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{session.sheet.title}</h1>
          <div className="flex items-center gap-2">
            {lessonButton}
            <div className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-sm font-semibold tabular-nums">
              <Timer className="size-4 text-sky-600" />
              {formatDuration(seconds)}
            </div>
            {inProgress && started && (
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                title={paused ? "Reprendre" : "Pause"}
                onClick={() => {
                  if (!paused) sendHeartbeat();
                  setPaused((p) => !p);
                }}
              >
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Étapes */}
        <div className="flex flex-wrap items-center gap-2">
          {exercises.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setIndex(i)}
              disabled={!started && inProgress}
              className={cn(
                "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors",
                i === index && session.status === "in_progress" ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200 bg-white",
                isDone(e) && i !== index && "border-emerald-200 bg-emerald-50 text-emerald-800"
              )}
            >
              {i + 1}. {TYPE_LABELS[e.type]}
              {isDone(e) && (
                <span className="tabular-nums">
                  {e.items_correct}/{e.items_total}
                </span>
              )}
            </button>
          ))}
          {inProgress && answeredUnits > 0 && (
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {correctUnits}/{answeredUnits} juste{correctUnits > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {session.status === "completed" ? (
        <>
          <SessionReportView session={session} onRestart={restart} restarting={restarting} />
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Revoir mes réponses</h2>
            {exercises.map((e, i) => (
              <ExerciseCard key={e.id} exercise={e} number={i + 1} total={exercises.length} readOnly onAnswer={answer} />
            ))}
          </div>
        </>
      ) : !started ? (
        <div className="space-y-5">
          {session.plan?.intro_message && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
              <Md>{session.plan.intro_message}</Md>
            </div>
          )}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Avant de commencer, relis la leçon</h2>
            <LessonView lesson={session.sheet.lesson} />
          </div>
          <div className="flex justify-center">
            <Button size="lg" className="gap-2" onClick={() => setStarted(true)}>
              <Play className="size-4" /> C&apos;est parti ! ({exercises.length} exercices)
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {paused && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-start gap-3 rounded-2xl bg-white/80 pt-24 backdrop-blur-md">
              <p className="text-lg font-semibold">Session en pause</p>
              <Button className="gap-2" onClick={() => setPaused(false)}>
                <Play className="size-4" /> Reprendre
              </Button>
            </div>
          )}
          <ExerciseCard
            exercise={current}
            number={index + 1}
            total={exercises.length}
            readOnly={paused}
            onAnswer={answer}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            {isDone(current) && !allDone && (
              <Button
                className="gap-2"
                onClick={() => {
                  const next = exercises.findIndex((e, i) => i > index && !isDone(e));
                  setIndex(next === -1 ? exercises.findIndex((e) => !isDone(e)) : next);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Exercice suivant <ArrowRight className="size-4" />
              </Button>
            )}
            {allDone && (
              <Button className="gap-2" onClick={complete} disabled={completing}>
                <Flag className="size-4" />
                {completing ? "Le prof prépare ton bilan…" : "Terminer et voir mon bilan"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  number,
  total,
  readOnly,
  onAnswer,
}: {
  exercise: SessionExercise;
  number: number;
  total: number;
  readOnly: boolean;
  onAnswer: (exerciseId: number, itemKey: string, value: unknown) => Promise<void>;
}) {
  const answered = exercise.item_keys.filter((k) => exercise.answers[k]).length;
  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            Exercice {number}/{total} · {TYPE_LABELS[exercise.type]}
          </div>
          <h3 className="text-lg font-bold">{exercise.payload.title}</h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums",
            isDone(exercise) ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
          )}
        >
          {isDone(exercise)
            ? `${exercise.items_correct}/${exercise.items_total}`
            : `${answered}/${exercise.item_keys.length}`}
        </span>
      </div>
      <p className="rounded-lg bg-gray-50 px-3 py-2 font-semibold text-gray-900">
        <Md>{exercise.payload.instruction}</Md>
      </p>
      <ExerciseWidget
        payload={exercise.payload}
        answers={exercise.answers}
        readOnly={readOnly}
        onAnswer={(itemKey, value) => onAnswer(exercise.id, itemKey, value)}
      />
    </div>
  );
}
