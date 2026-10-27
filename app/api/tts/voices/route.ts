import { auth } from "@/lib/auth";
import { defaultVoiceId, isTtsConfigured, listVoices } from "@/lib/tts";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tts/voices[?status=1] - Whether speech is available, and the voices to pick from
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?status=1: cheap check used by the ▶ buttons (no call to ElevenLabs)
  if (!isTtsConfigured() || request.nextUrl.searchParams.get("status")) {
    return NextResponse.json({ configured: isTtsConfigured(), voices: [], default_voice_id: null });
  }

  try {
    const [voices, defaultId] = await Promise.all([listVoices(), defaultVoiceId()]);
    return NextResponse.json({ configured: true, voices, default_voice_id: defaultId });
  } catch (error) {
    console.error("Error listing voices:", error);
    return NextResponse.json({ configured: true, voices: [], default_voice_id: null, error: "Liste des voix indisponible" });
  }
}
