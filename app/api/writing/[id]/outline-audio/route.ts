import { resolveProfileForRequest } from "@/lib/todo-api";
import { TtsPlanError } from "@/lib/tts";
import { findOwnedProject, outlineAudio, speechChunks } from "@/lib/writing/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_OUTLINE_CHARS = 6000;

// POST /api/writing/[id]/outline-audio - The outline read aloud. Recorded on the
// first ▶ and saved on the project; a modified outline is recorded again.
// Body { outline } reads the outline the coach just proposed, not yet validated:
// its recording is kept too, so validating it unchanged reuses it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let outline: string | null = null;
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const proposed = typeof body?.outline === "string" ? body.outline.slice(0, MAX_OUTLINE_CHARS) : null;
    outline = proposed ?? project.outline;

    const audio = await outlineAudio({ ...project, outline }, resolved.profileId);
    if (!audio) return NextResponse.json({ error: "Pas encore de trame" }, { status: 400 });
    return NextResponse.json(audio);
  } catch (error) {
    console.error("Error reading outline aloud:", error);
    // ElevenLabs unavailable: the device voice reads it
    if (outline) {
      return NextResponse.json({
        engine: "device",
        texts: speechChunks(outline),
        notice: error instanceof TtsPlanError ? "Cette voix demande une offre ElevenLabs payante" : "Voix de l'appareil utilisée",
      });
    }
    return NextResponse.json({ error: "La lecture audio a échoué" }, { status: 500 });
  }
}
