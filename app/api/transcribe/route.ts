import { AI_MODEL_TRANSCRIBE } from "@/lib/ai-models";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
const MAX_BYTES = 10 * 1024 * 1024;

// POST /api/transcribe (multipart: audio) - Voice dictation, for browsers
// without built-in speech recognition (Firefox…)
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Aucun son reçu" }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: "Enregistrement trop long" }, { status: 400 });
    }

    const result = await client.audio.transcriptions.create({
      file: audio,
      model: AI_MODEL_TRANSCRIBE,
      language: "fr",
    });
    return NextResponse.json({ text: result.text.trim() });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json({ error: "Je n'ai pas compris, réessaie" }, { status: 500 });
  }
}
