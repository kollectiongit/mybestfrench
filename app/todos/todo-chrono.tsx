"use client";

import { motion } from "motion/react";
import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TodoChrono({
  todoName,
  onValidate,
  onClose,
}: {
  todoName: string;
  onValidate: (seconds: number) => void;
  onClose: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Accumulated seconds before the current running segment.
  const baseRef = useRef(0);
  // Timestamp (ms) when the current running segment started.
  const segmentStartRef = useRef(Date.now());
  // The clock time the chrono was launched (displayed to the user).
  const [launchTime] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  useEffect(() => {
    if (!running) return;
    segmentStartRef.current = Date.now();
    const interval = setInterval(() => {
      const segment = (Date.now() - segmentStartRef.current) / 1000;
      setElapsed(baseRef.current + segment);
    }, 250);
    return () => clearInterval(interval);
  }, [running]);

  const pause = () => {
    baseRef.current += (Date.now() - segmentStartRef.current) / 1000;
    setElapsed(baseRef.current);
    setRunning(false);
  };

  const resume = () => {
    segmentStartRef.current = Date.now();
    setRunning(true);
  };

  const reset = () => {
    baseRef.current = 0;
    segmentStartRef.current = Date.now();
    setElapsed(0);
  };

  const validate = () => {
    const finalSeconds = running
      ? baseRef.current + (Date.now() - segmentStartRef.current) / 1000
      : baseRef.current;
    onValidate(Math.round(finalSeconds));
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-center px-6">
        <p className="text-lg md:text-2xl font-medium text-gray-300 mb-2">
          {todoName}
        </p>
        <p className="text-sm text-gray-500 mb-8">Démarré à {launchTime}</p>

        <div className="font-mono font-bold tabular-nums text-6xl md:text-8xl lg:text-9xl tracking-tight">
          {formatHMS(elapsed)}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {running ? (
            <button
              type="button"
              onClick={pause}
              className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-medium hover:bg-white/20 transition-colors"
            >
              <Pause className="h-5 w-5" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-medium hover:bg-white/20 transition-colors"
            >
              <Play className="h-5 w-5" />
              Reprendre
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-medium hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="flex items-center gap-2 rounded-full bg-red-500/20 text-red-300 px-6 py-3 text-base font-medium hover:bg-red-500/30 transition-colors"
          >
            <X className="h-5 w-5" />
            Annuler
          </button>
          <button
            type="button"
            onClick={validate}
            className="flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-base font-semibold text-white hover:bg-green-600 transition-colors"
          >
            <Check className="h-5 w-5" />
            Valider le temps
          </button>
        </div>
      </div>

      {confirmCancel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="mx-4 max-w-sm rounded-2xl bg-white p-6 text-center text-gray-900 shadow-2xl">
            <p className="text-lg font-semibold">
              Es-tu sûr de vouloir annuler le chrono ?
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Le temps écoulé sera perdu.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-full border px-5 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Non, continuer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Oui, annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
