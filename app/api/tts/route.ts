import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { isTtsConfigured, speak, TTS_MAX_CHARS, TtsPlanError, voiceForProfile } from "@/lib/tts";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/tts  { text, session_id? } - Audio URL of the text, read with the
// training session's voice when given, else the current profile's voice.
// Returns { engine: "device" } when the browser's own voice must read it
// (profile set to "Voix de l'appareil", or ElevenLabs not configured).
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const profile = await prisma.profiles.findUnique({
      where: { id: resolved.profileId },
      select: { tts_voice_mode: true },
    });
    if (!isTtsConfigured() || profile?.tts_voice_mode === "device") {
      return NextResponse.json({ engine: "device" });
    }

    const body = await request.json();
    const text = body.text?.toString() ?? "";
    if (!text.trim()) return NextResponse.json({ error: "Texte vide" }, { status: 400 });
    if (text.length > TTS_MAX_CHARS * 2) {
      return NextResponse.json({ error: "Texte trop long" }, { status: 400 });
    }

    let voiceId: string | null = null;
    if (typeof body.session_id === "string" && body.session_id) {
      const session = await prisma.training_session.findFirst({
        where: {
          id: body.session_id,
          user_id: resolved.session.user.id,
          profile_id: resolved.profileId,
        },
        select: { tts_voice_id: true },
      });
      voiceId = session?.tts_voice_id ?? null;
    }
    voiceId ??= await voiceForProfile(resolved.profileId);
    if (!voiceId) {
      return NextResponse.json({ error: "Aucune voix disponible" }, { status: 503 });
    }

    const { url } = await speak(text, voiceId, resolved.profileId);
    return NextResponse.json({ engine: "elevenlabs", url });
  } catch (error) {
    console.error("Error generating speech:", error);
    if (error instanceof TtsPlanError) {
      return NextResponse.json(
        { error: "Cette voix demande une offre ElevenLabs payante" },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: "La lecture audio a échoué" }, { status: 500 });
  }
}
