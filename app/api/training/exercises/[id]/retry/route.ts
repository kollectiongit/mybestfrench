import { prisma } from "@/lib/prisma";
import { findOwnedSession, retryExercise, serializeSession } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// POST /api/training/exercises/[id]/retry - Redo a failed exercise (new questions)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const userId = resolved.session.user.id;
    const newId = await retryExercise(Number((await params).id), userId, resolved.profileId);
    if (!newId) {
      return NextResponse.json({ error: "Cet exercice ne peut pas être refait" }, { status: 400 });
    }

    const { session_id } = await prisma.training_exercise.findUniqueOrThrow({
      where: { id: newId },
      select: { session_id: true },
    });
    const session = await findOwnedSession(session_id, userId, resolved.profileId);
    return NextResponse.json({ session: serializeSession(session!), exercise_id: newId });
  } catch (error) {
    console.error("Error retrying training exercise:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
