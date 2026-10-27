"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countWords } from "@/lib/writing/words";
import { CheckCircle2, Cloud, CloudOff, Ear, Loader2, MessagesSquare, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Attempt, Project } from "../types";
import { HintButton, OutlineListenButton, SentencePlayer } from "./audio";

const SERVER_SAVE_MS = 2000;
/** Time counts only while the student is active (typed less than a minute ago). */
const IDLE_AFTER_MS = 60_000;

interface LocalDraft {
  text: string;
  at: string;
  seconds: number;
}

const storageKey = (projectId: string) => `writing-draft:${projectId}`;

function readLocal(projectId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(projectId: string) {
  try {
    localStorage.removeItem(storageKey(projectId));
  } catch {}
}

/**
 * Step 2 — writing. Pasting is refused; every keystroke is kept in
 * localStorage and saved to the database a moment later, so the student can
 * leave and come back.
 */
export function WritingEditor({
  project,
  lastAttempt,
  initialDictationOpen = false,
  onEditOutline,
  onSubmitted,
}: {
  project: Project;
  lastAttempt: Attempt | null;
  initialDictationOpen?: boolean;
  onEditOutline: () => void;
  onSubmitted: (attempt: Attempt) => void;
}) {
  const [text, setText] = useState(project.draft_text);
  const [seconds, setSeconds] = useState(project.draft_active_seconds);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [submitting, setSubmitting] = useState(false);
  const [showDictation, setShowDictation] = useState(initialDictationOpen);
  const textRef = useRef(text);
  const secondsRef = useRef(seconds);
  const lastKeyAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const words = countWords(text);
  const goal = project.min_words;
  const reached = words >= goal;

  // Resume the most recent draft: this browser's or the database's
  useEffect(() => {
    const local = readLocal(project.id);
    const serverAt = project.draft_updated_at ? new Date(project.draft_updated_at).getTime() : 0;
    if (local && new Date(local.at).getTime() > serverAt && local.text !== project.draft_text) {
      setText(local.text);
      textRef.current = local.text;
      setSeconds(local.seconds);
      secondsRef.current = local.seconds;
      dirty.current = true;
      scheduleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const saveToServer = useCallback(
    async (keepalive = false) => {
      if (!dirty.current) return;
      dirty.current = false;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/writing/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft_text: textRef.current, active_seconds: secondsRef.current }),
          keepalive,
        });
        if (!res.ok) throw new Error();
        setSaveState("saved");
      } catch {
        dirty.current = true;
        setSaveState("offline");
      }
    },
    [project.id]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToServer(), SERVER_SAVE_MS);
  }, [saveToServer]);

  // Flush when the page is hidden or left
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") saveToServer(true);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveToServer(true);
    };
  }, [saveToServer]);

  // Active writing time
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastKeyAt.current > IDLE_AFTER_MS) return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const change = (value: string) => {
    setText(value);
    textRef.current = value;
    lastKeyAt.current = Date.now();
    dirty.current = true;
    try {
      localStorage.setItem(
        storageKey(project.id),
        JSON.stringify({ text: value, at: new Date().toISOString(), seconds: secondsRef.current } satisfies LocalDraft)
      );
    } catch {}
    scheduleSave();
  };

  const refusePaste = (e: React.SyntheticEvent) => {
    e.preventDefault();
    toast.message("Le copier-coller est désactivé : écris ton texte toi-même ✍️");
  };

  const submit = async () => {
    if (!reached || submitting) return;
    if (!window.confirm("Rendre ta copie au prof ? Elle sera corrigée et notée.")) return;
    setSubmitting(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveToServer();
    try {
      const res = await fetch(`/api/writing/${project.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textRef.current, active_seconds: secondsRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      clearLocalDraft(project.id);
      dirty.current = false;
      onSubmitted(data.attempt as Attempt);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "La correction a échoué, réessaie");
      setSubmitting(false);
    }
  };

  const pct = Math.min(100, Math.round((words / goal) * 100));
  const minutes = Math.floor(seconds / 60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-xs">
        <OutlineListenButton projectId={project.id} />
        <HintButton projectId={project.id} getDraft={() => textRef.current} />
        {lastAttempt && (
          <Button variant="outline" onClick={() => setShowDictation((v) => !v)} className={cn(showDictation && "bg-sky-50")}>
            <Ear className="size-4" /> Version améliorée en dictée
          </Button>
        )}
        <Button variant="ghost" onClick={onEditOutline} className="ml-auto text-muted-foreground">
          <MessagesSquare className="size-4" /> Modifier ma trame
        </Button>
      </div>

      {showDictation && lastAttempt && (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-sm text-sky-900">
            Écoute la version améliorée de ton essai n°{lastAttempt.number}, phrase par phrase, et réécris-la comme une
            dictée. Tu peux aussi écrire un texte tout nouveau à partir de ta trame.
          </p>
          <SentencePlayer text={lastAttempt.improved_text} />
        </div>
      )}

      <div className="rounded-2xl border bg-white shadow-xs">
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          onPaste={refusePaste}
          onDrop={refusePaste}
          onBeforeInput={(e) => {
            const type = (e.nativeEvent as InputEvent).inputType;
            if (type === "insertFromPaste" || type === "insertFromDrop" || type === "insertFromPasteAsQuotation") {
              refusePaste(e);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          spellCheck={false}
          autoCorrect="off"
          autoComplete="off"
          disabled={submitting}
          rows={16}
          placeholder={`Écris ici ton texte (au moins ${goal} mots)…`}
          className="block min-h-[50vh] w-full resize-y rounded-t-2xl p-5 text-lg leading-relaxed outline-none disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
          <div className="min-w-48 flex-1">
            <div className="flex justify-between text-sm">
              <span className={cn("font-semibold tabular-nums", reached ? "text-emerald-700" : "text-gray-800")}>
                {words} / {goal} mots
              </span>
              <span className="text-muted-foreground">
                {reached ? "Objectif atteint !" : `encore ${goal - words}`}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn("h-full rounded-full transition-all", reached ? "bg-emerald-500" : "bg-sky-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums" title="Temps passé à écrire">
            {minutes} min
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveState === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveState === "offline" ? (
              <CloudOff className="size-3.5 text-amber-600" />
            ) : (
              <Cloud className="size-3.5" />
            )}
            {saveState === "offline" ? "Gardé sur cet appareil" : "Enregistré"}
          </span>
          <Button onClick={submit} disabled={!reached || submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : reached ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
            {submitting ? "Le prof corrige ta copie…" : "Rendre ma copie"}
          </Button>
        </div>
      </div>
    </div>
  );
}
