"use client";

import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { Loader2 } from "lucide-react";

/** Full-width waiting state while the AI works (analysis or exercise generation). */
export function Preparing({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Loader2 className="size-8 animate-spin text-sky-500" />
      <TextShimmer className="text-lg font-medium" duration={1.5}>
        {message}
      </TextShimmer>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Starts a new session of a sheet; returns the new session id. */
export async function startSession(sheetId: number): Promise<string> {
  const res = await fetch(`/api/training/sheets/${sheetId}/sessions`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur");
  return data.session.id as string;
}
