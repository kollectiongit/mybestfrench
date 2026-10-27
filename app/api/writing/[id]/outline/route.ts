import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { synthesizeOutline } from "@/lib/writing/ai";
import { findOwnedProject, getStudentContext, sanitizeMessages } from "@/lib/writing/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// POST /api/writing/[id]/outline - Draft of the outline from the discussion (not saved)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const messages = sanitizeMessages(project.chat_json);
    if (!messages.some((m) => m.role === "user")) {
      return NextResponse.json({ error: "Discute d'abord de ton sujet avec le prof" }, { status: 400 });
    }
    const outline = await synthesizeOutline({
      student: await getStudentContext(resolved.profileId, project.id),
      messages,
    });
    return NextResponse.json({ outline });
  } catch (error) {
    console.error("Error drafting outline:", error);
    return NextResponse.json({ error: "La trame n'a pas pu être préparée, réessaie" }, { status: 500 });
  }
}

// PUT /api/writing/[id]/outline  { title, outline } - Validate the outline: on to writing
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const body = await request.json();
    const title = body.title?.toString().trim().slice(0, 200);
    const outline = body.outline?.toString().trim().slice(0, 6000);
    if (!title || !outline) return NextResponse.json({ error: "Trame incomplète" }, { status: 400 });

    const changed = outline !== project.outline;
    await prisma.writing_project.update({
      where: { id: project.id },
      data: {
        title,
        outline,
        status: "writing",
        outline_validated_at: new Date(),
        // A new outline needs a new recording
        ...(changed ? { outline_audio_hash: null, outline_audio_urls: [] } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error validating outline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
