"use client";

import { cleanTextForSpeech } from "@/lib/speech-text";
import { cn } from "@/lib/utils";
import { Loader2, Square, Volume2 } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Shared across buttons: only one sound plays at a time, and each text's URL
// is remembered for the page's lifetime so a replay costs nothing.
let statusPromise: Promise<boolean> | null = null;
const urlCache = new Map<string, string>();
const DEVICE = "device"; // urlCache marker: this text is read by the device voice
let stopCurrent: (() => void) | null = null;
let currentOwner: symbol | null = null;
let fallbackNoticeShown = false;

/** Training session whose voice reads the text (one voice per session). */
export const SpeechSessionContext = createContext<string | null>(null);

// ---------------------------------------------------------------------------
// Device voice (Web Speech API): free, built into the browser / OS
// ---------------------------------------------------------------------------

export function isDeviceSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Voices load asynchronously in some browsers (Chrome): wait for them briefly. */
function deviceVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1000);
  });
}

/** Best French voice of the device (enhanced/natural ones first). */
export async function pickDeviceVoice(): Promise<SpeechSynthesisVoice | null> {
  const french = (await deviceVoices()).filter((v) => v.lang.toLowerCase().startsWith("fr"));
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase() === "fr-fr" ? 4 : 0) +
    (/premium|enhanced|améliorée|natural|neural|online/i.test(v.name) ? 2 : 0) +
    (/am[ée]lie|thomas|audrey|aur[ée]lie|denise|henri|google/i.test(v.name) ? 1 : 0);
  return french.sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Reads the text with the device voice and returns a function that stops it. */
export async function speakOnDevice(text: string, onEnd: () => void): Promise<() => void> {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
  const voice = await pickDeviceVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "fr-FR";
  utterance.rate = 0.95;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return () => {
    synth.cancel();
    onEnd();
  };
}

// ---------------------------------------------------------------------------

function useSpeechAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    statusPromise ??= fetch("/api/tts/voices?status=1")
      .then((r) => r.json())
      .then((d) => !!d.configured)
      .catch(() => false);
    let alive = true;
    // The device voice makes ▶ usable even without ElevenLabs
    statusPromise.then((ok) => alive && setAvailable(ok || isDeviceSpeechSupported()));
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
  const available = useSpeechAvailable();
  const sessionId = useContext(SpeechSessionContext);
  const cacheKey = `${sessionId ?? ""}|${text}`;
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const owner = useRef(Symbol("speak-button"));

  // Stop our own sound when the button disappears (next exercise, page change)
  useEffect(() => {
    const me = owner.current;
    return () => {
      if (currentOwner === me) stopCurrent?.();
    };
  }, []);

  if (!available || !text.trim()) return null;

  const begin = (stop: () => void) => {
    stopCurrent = stop;
    currentOwner = owner.current;
    setState("playing");
  };
  const ended = () => {
    if (currentOwner === owner.current) {
      currentOwner = null;
      stopCurrent = null;
    }
    setState("idle");
  };

  const playOnDevice = async () => {
    begin(await speakOnDevice(text, ended));
  };

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
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.engine === "device") {
          url = DEVICE;
        } else if (res.ok && data.url) {
          url = data.url as string;
        } else if (res.status !== 400 && isDeviceSpeechSupported()) {
          // ElevenLabs unavailable (credits, network…): read it anyway, not cached
          if (!fallbackNoticeShown) {
            fallbackNoticeShown = true;
            toast.message("Voix de l'appareil utilisée", { description: data.error });
          }
          await playOnDevice();
          return;
        } else {
          throw new Error(data.error ?? "Lecture impossible");
        }
        urlCache.set(cacheKey, url);
      }

      if (url === DEVICE) {
        await playOnDevice();
        return;
      }
      const audio = new Audio(url);
      audio.onended = ended;
      audio.onerror = ended;
      await audio.play();
      begin(() => {
        audio.pause();
        ended();
      });
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Lecture impossible");
    }
  };

  return (
    <button
      type="button"
      onClick={play}
      title={state === "playing" ? "Arrêter" : `${label} (voix de synthèse)`}
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

// ---------------------------------------------------------------------------
// Imperative playback (outline, oral hints, sentence-by-sentence dictée)
// ---------------------------------------------------------------------------

/** One piece to play: a ready mp3, or a text read by the device voice. */
export type SpeechSource = { url: string } | { text: string };

/**
 * Plays the sources one after the other (stopping any other sound) and calls
 * `onEnd` when done or stopped. Returns a function that stops it.
 */
export function playSources(sources: SpeechSource[], onEnd: () => void): () => void {
  stopCurrent?.();
  const me = Symbol("play-sources");
  let stopped = false;
  let stopPiece: (() => void) | null = null;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (currentOwner === me) {
      currentOwner = null;
      stopCurrent = null;
    }
    onEnd();
  };
  const stop = () => {
    stopPiece?.();
    finish();
  };
  stopCurrent = stop;
  currentOwner = me;

  const next = async (i: number) => {
    if (stopped) return;
    const source = sources[i];
    if (!source) return finish();
    if ("url" in source) {
      const audio = new Audio(source.url);
      audio.onended = () => next(i + 1);
      audio.onerror = () => next(i + 1);
      stopPiece = () => audio.pause();
      await audio.play().catch(() => finish());
    } else {
      // speakOnDevice's own stop calls onEnd: ignore it once we are stopped
      stopPiece = await speakOnDevice(source.text, () => {
        if (!stopped) next(i + 1);
      });
    }
  };
  next(0);
  return stop;
}

/** Plays a text like the ▶ button does (cached URL, device voice fallback). */
export async function playText(text: string, onEnd: () => void): Promise<() => void> {
  const key = `|${text}`;
  let url = urlCache.get(key);
  if (!url) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.engine === "device") url = DEVICE;
    else if (res.ok && data.url) url = data.url as string;
    else if (res.status !== 400 && isDeviceSpeechSupported()) {
      return playSources([{ text }], onEnd);
    } else throw new Error(data.error ?? "Lecture impossible");
    urlCache.set(key, url);
  }
  return playSources([url === DEVICE ? { text } : { url }], onEnd);
}

/** Stops whatever is playing (button, outline, hint…). */
export function stopSpeech() {
  stopCurrent?.();
}
