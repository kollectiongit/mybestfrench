"use client";

import { playSources, playText, SpeechSource, stopSpeech } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { splitSentences } from "@/lib/writing/words";
import { ChevronLeft, ChevronRight, Headphones, Lightbulb, Loader2, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type State = "idle" | "loading" | "playing";

/** Plays sources fetched from an endpoint, with a loading / playing / stop button state. */
function useEndpointPlayer() {
  const [state, setState] = useState<State>("idle");
  useEffect(() => () => stopSpeech(), []);

  const run = async (fetchSources: () => Promise<SpeechSource[]>) => {
    if (state === "playing") {
      stopSpeech();
      return;
    }
    if (state === "loading") return;
    setState("loading");
    try {
      const sources = await fetchSources();
      if (!sources.length) throw new Error("Rien à lire");
      setState("playing");
      playSources(sources, () => setState("idle"));
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Lecture impossible");
    }
  };
  return { state, run };
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Lecture impossible");
  return data;
}

/**
 * ▶ The outline read aloud (recorded once, then served from the project).
 * `outline` reads a proposed outline instead of the validated one.
 */
export function OutlineListenButton({ projectId, outline }: { projectId: string; outline?: string }) {
  const { state, run } = useEndpointPlayer();
  return (
    <Button
      variant="outline"
      onClick={() =>
        run(async () => {
          const data = await postJson(`/api/writing/${projectId}/outline-audio`, outline ? { outline } : undefined);
          if (data.notice) toast.message(data.notice);
          return data.engine === "device"
            ? (data.texts as string[]).map((text) => ({ text }))
            : (data.urls as string[]).map((url) => ({ url }));
        })
      }
    >
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "playing" ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <Headphones className="size-4" />
      )}
      {state === "playing" ? "Arrêter" : "Écouter ma trame"}
    </Button>
  );
}

/** Spoken nudge from the coach: heard, never shown. */
export function HintButton({ projectId, getDraft }: { projectId: string; getDraft: () => string }) {
  const { state, run } = useEndpointPlayer();
  return (
    <Button
      variant="outline"
      className="border-amber-300 text-amber-800 hover:bg-amber-50"
      onClick={() =>
        run(async () => {
          const data = await postJson(`/api/writing/${projectId}/hint`, { draft: getDraft() });
          return [data.engine === "device" ? { text: data.text as string } : { url: data.url as string }];
        })
      }
      title="Le prof te donne une idée à l'oral"
    >
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "playing" ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <Lightbulb className="size-4" />
      )}
      {state === "loading" ? "Le prof réfléchit…" : state === "playing" ? "Arrêter" : "Coup de pouce"}
    </Button>
  );
}

/**
 * The improved version of the last attempt read sentence by sentence, like a
 * dictée: the text itself is never shown.
 */
export function SentencePlayer({ text }: { text: string }) {
  const sentences = useMemo(() => splitSentences(text), [text]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<State>("idle");
  useEffect(() => () => stopSpeech(), []);

  const play = async (i: number) => {
    stopSpeech();
    setIndex(i);
    setState("loading");
    try {
      await playText(sentences[i], () => setState("idle"));
      setState("playing");
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Lecture impossible");
    }
  };

  if (!sentences.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" disabled={index === 0} onClick={() => play(index - 1)} title="Phrase précédente">
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        onClick={() => (state === "playing" ? stopSpeech() : play(index))}
        className="min-w-36"
        title="Écouter la phrase"
      >
        {state === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "playing" ? (
          <Square className="size-3.5 fill-current" />
        ) : (
          <RotateCcw className="size-4" />
        )}
        Phrase {index + 1} / {sentences.length}
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={index >= sentences.length - 1}
        onClick={() => play(index + 1)}
        title="Phrase suivante"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
