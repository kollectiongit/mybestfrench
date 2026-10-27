"use client";

import { cn } from "@/lib/utils";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Voice dictation: the browser's speech recognition when it has one (live
// text, Chrome / Safari / Edge), else a recording transcribed by the server.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictationButton({
  onText,
  onInterim,
  disabled,
  className,
}: {
  /** Final text of the dictation, to append to the message */
  onText: (text: string) => void;
  /** Live text while speaking (browser recognition only) */
  onInterim?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const stopRef = useRef<(() => void) | null>(null);
  // Known only in the browser (no button in the server render)
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(!!recognitionClass() || (!!navigator.mediaDevices && typeof MediaRecorder !== "undefined"));
    return () => stopRef.current?.();
  }, []);

  const startRecognition = (Ctor: new () => Recognition) => {
    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      onInterim?.(`${finalText}${interim}`.trim());
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Autorise le micro pour dicter ton message");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("La dictée s'est arrêtée");
    };
    recognition.onend = () => {
      stopRef.current = null;
      setState("idle");
      onInterim?.("");
      if (finalText.trim()) onText(finalText.trim());
    };
    recognition.start();
    stopRef.current = () => recognition.stop();
    setState("listening");
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Autorise le micro pour dicter ton message");
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      stopRef.current = null;
      setState("transcribing");
      try {
        const type = recorder.mimeType || "audio/webm";
        const form = new FormData();
        form.append("audio", new File(chunks, `dictee.${type.includes("mp4") ? "mp4" : "webm"}`, { type }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Je n'ai pas compris, réessaie");
        if (data.text) onText(data.text);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Je n'ai pas compris, réessaie");
      } finally {
        setState("idle");
      }
    };
    recorder.start();
    stopRef.current = () => recorder.stop();
    setState("listening");
  };

  if (!supported) return null;

  const toggle = () => {
    if (state === "listening") {
      stopRef.current?.();
      return;
    }
    if (state !== "idle") return;
    const Ctor = recognitionClass();
    if (Ctor) startRecognition(Ctor);
    else startRecording();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || state === "transcribing"}
      title={state === "listening" ? "Arrêter la dictée" : "Dicter mon message"}
      aria-label={state === "listening" ? "Arrêter la dictée" : "Dicter mon message"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
        state === "listening"
          ? "animate-pulse border-red-300 bg-red-50 text-red-600"
          : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
        className
      )}
    >
      {state === "transcribing" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "listening" ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
