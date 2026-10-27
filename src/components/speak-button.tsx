"use client";

import { cn } from "@/lib/utils";
import { Loader2, Square, Volume2 } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Shared across buttons: only one sound plays at a time, and each text's URL
// is remembered for the page's lifetime so a replay costs nothing.
let statusPromise: Promise<boolean> | null = null;
const urlCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let stopCurrent: (() => void) | null = null;

/** Training session whose voice reads the text (one voice per session). */
export const SpeechSessionContext = createContext<string | null>(null);

function useTtsAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    statusPromise ??= fetch("/api/tts/voices?status=1")
      .then((r) => r.json())
      .then((d) => !!d.configured)
      .catch(() => false);
    let alive = true;
    statusPromise.then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

/** Forgets cached URLs (e.g. after the profile's voice changed). */
export function resetSpeechCache() {
  urlCache.clear();
}

export function SpeakButton({
  text,
  className,
  label = "Écouter",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const available = useTtsAvailable();
  const sessionId = useContext(SpeechSessionContext);
  const cacheKey = `${sessionId ?? ""}|${text}`;
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const ownAudio = useRef<HTMLAudioElement | null>(null);

  // Stop our own sound when the button disappears (next exercise, page change)
  useEffect(
    () => () => {
      if (ownAudio.current && ownAudio.current === currentAudio) stopCurrent?.();
    },
    []
  );

  if (!available || !text.trim()) return null;

  const play = async () => {
    if (state === "playing") {
      stopCurrent?.();
      return;
    }
    stopCurrent?.();
    setState("loading");
    try {
      let url = urlCache.get(cacheKey);
      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, session_id: sessionId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lecture impossible");
        url = data.url as string;
        urlCache.set(cacheKey, url);
      }
      const audio = new Audio(url);
      currentAudio = audio;
      ownAudio.current = audio;
      const stop = () => {
        audio.pause();
        if (currentAudio === audio) currentAudio = null;
        setState("idle");
      };
      stopCurrent = stop;
      audio.onended = stop;
      audio.onerror = stop;
      await audio.play();
      setState("playing");
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Lecture impossible");
    }
  };

  return (
    <button
      type="button"
      onClick={play}
      title={`${state === "playing" ? "Arrêter" : label} (voix générée par IA)`}
      aria-label={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full align-middle text-sky-600 transition-colors hover:bg-sky-100",
        state === "playing" && "bg-sky-100",
        className
      )}
    >
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "playing" ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <Volume2 className="size-4" />
      )}
    </button>
  );
}
