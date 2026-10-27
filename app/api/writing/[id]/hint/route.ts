import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { isTtsConfigured, speak, voiceForProfile } from "@/lib/tts";
import { writingHint } from "@/lib/writing/ai";
import { findOwnedProject, getStudentContext, MAX_TEXT_LENGTH } from "@/lib/writing/server";
import { countWords } from "@/lib/writing/words";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/writing/[id]/hint  { draft } - Spoken nudge while writing. The text
// is only sent back for the device voice: the student never sees it written.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project?.outline) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const draft = (typeof body.draft === "string" ? body.draft : project.draft_text).slice(0, MAX_TEXT_LENGTH);
    const hint = await writingHint({
      student: await getStudentContext(resolved.profileId, project.id),
      outline: project.outline,
      draft,
      minWords: project.min_words,
      wordCount: countWords(draft),
    });

    const profile = await prisma.profiles.findUnique({
      where: { id: resolved.profileId },
      select: { tts_voice_mode: true },
    });
    if (isTtsConfigured() && profile?.tts_voice_mode !== "device") {
      const voiceId = await voiceForProfile(resolved.profileId);
      if (voiceId) {
        try {
          const { url } = await speak(hint, voiceId, resolved.profileId);
          return NextResponse.json({ engine: "elevenlabs", url });
        } catch (error) {
          console.error("Error speaking writing hint, device voice used:", error);
        }
      }
    }
    return NextResponse.json({ engine: "device", text: hint });
  } catch (error) {
    console.error("Error giving writing hint:", error);
    return NextResponse.json({ error: "Le prof n'est pas disponible, réessaie" }, { status: 500 });
  }
}
