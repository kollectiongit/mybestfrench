import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { findOwnedProject, MAX_TEXT_LENGTH, serializeProject } from "@/lib/writing/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/writing/[id]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });
    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    console.error("Error fetching writing project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/writing/[id]  { draft_text?, active_seconds?, status?, title?, archived? }
// Saves the draft (also kept in localStorage), or goes back to the outline discussion.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const body = await request.json();
    const data: Parameters<typeof prisma.writing_project.update>[0]["data"] = {};
    if (typeof body.draft_text === "string") {
      data.draft_text = body.draft_text.slice(0, MAX_TEXT_LENGTH);
      data.draft_updated_at = new Date();
    }
    if (Number.isFinite(body.active_seconds) && body.active_seconds >= 0) {
      data.draft_active_seconds = Math.min(Math.round(body.active_seconds), 24 * 3600);
    }
    if (body.status === "planning") data.status = "planning";
    if (body.status === "writing" && project.outline) data.status = "writing";
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 200);
    if (typeof body.archived === "boolean") data.archived = body.archived;

    await prisma.writing_project.update({ where: { id: project.id }, data });
    return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
  } catch (error) {
    console.error("Error updating writing project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/writing/[id] - The expression écrite and all its attempts (cascade).
// Exercise sheets generated from its corrections are kept.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    await prisma.writing_project.delete({ where: { id: project.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting writing project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
