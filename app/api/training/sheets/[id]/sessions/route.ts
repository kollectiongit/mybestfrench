import { createSession } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/training/sheets/[id]/sessions - Start a new session (generates its exercises)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const session = await createSession({
      sheetId: Number((await params).id),
      profileId: resolved.profileId,
      userId: resolved.session.user.id,
    });
    if (!session) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error creating training session:", error);
    return NextResponse.json(
      { error: "La préparation des exercices a échoué, réessaie dans un instant" },
      { status: 500 }
    );
  }
}
