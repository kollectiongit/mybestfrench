import { resolveProfileForRequest } from "@/lib/todo-api";
import { isTtsConfigured, speak, TTS_MAX_CHARS, voiceForProfile } from "@/lib/tts";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/tts  { text } - Audio URL of the text read with the current profile's voice
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    if (!isTtsConfigured()) {
      return NextResponse.json({ error: "La voix n'est pas encore configurée" }, { status: 503 });
    }

    const body = await request.json();
    const text = body.text?.toString() ?? "";
    if (!text.trim()) return NextResponse.json({ error: "Texte vide" }, { status: 400 });
    if (text.length > TTS_MAX_CHARS * 2) {
      return NextResponse.json({ error: "Texte trop long" }, { status: 400 });
    }

    const voiceId = await voiceForProfile(resolved.profileId);
    if (!voiceId) {
      return NextResponse.json({ error: "Aucune voix disponible" }, { status: 503 });
    }

    const { url } = await speak(text, voiceId, resolved.profileId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating speech:", error);
    return NextResponse.json({ error: "La lecture audio a échoué" }, { status: 500 });
  }
}
