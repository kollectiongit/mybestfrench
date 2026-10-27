import { completeSession, serializeSession } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/training/sessions/[id]/complete - Final score, skills and report
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const session = await completeSession(
      (await params).id,
      resolved.session.user.id,
      resolved.profileId
    );
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });

    return NextResponse.json({ session: serializeSession(session) });
  } catch (error) {
    console.error("Error completing training session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
