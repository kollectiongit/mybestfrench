import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DELETE /api/writing/attempts/[id] - One attempt. The following ones are
// renumbered so the attempts stay "Essai 1, 2, 3…". Exercise sheets generated
// from its correction are kept.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Essai introuvable" }, { status: 404 });

    const attempt = await prisma.writing_attempt.findFirst({
      where: { id, profile_id: resolved.profileId, project: { user_id: resolved.session.user.id } },
      select: { id: true, project_id: true, number: true },
    });
    if (!attempt) return NextResponse.json({ error: "Essai introuvable" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.writing_attempt.delete({ where: { id: attempt.id } });
      const following = await tx.writing_attempt.findMany({
        where: { project_id: attempt.project_id, number: { gt: attempt.number } },
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      });
      // In ascending order, each new number is already free
      for (const a of following) {
        await tx.writing_attempt.update({ where: { id: a.id }, data: { number: a.number - 1 } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting writing attempt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
