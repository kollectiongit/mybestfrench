import { getProfileContext } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { startPractice } from "@/lib/writing/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/writing/attempts/[id]/practice  { index } - Exercises on one point
// to work on of the correction (an exercise session, like the training sheets)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const body = await request.json().catch(() => ({}));
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Point à travailler manquant" }, { status: 400 });
    }

    const student = await getProfileContext(resolved.profileId);
    const result = await startPractice({
      attemptId: Number((await params).id),
      index,
      userId: resolved.session.user.id,
      profileId: resolved.profileId,
      levelLabel: student.levelLabel,
    });
    if (!result) return NextResponse.json({ error: "Essai introuvable" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error starting writing practice:", error);
    return NextResponse.json(
      { error: "La préparation des exercices a échoué, réessaie dans un instant" },
      { status: 500 }
    );
  }
}
