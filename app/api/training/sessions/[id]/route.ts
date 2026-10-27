import { prisma } from "@/lib/prisma";
import { findOwnedSession, serializeSession } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/training/sessions/[id]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const session = await findOwnedSession(
      (await params).id,
      resolved.session.user.id,
      resolved.profileId
    );
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });

    return NextResponse.json(
      { session: serializeSession(session) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error fetching training session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Heartbeats come every ~15 s; never accept a bigger jump than this.
const MAX_HEARTBEAT_STEP = 120;

// PATCH /api/training/sessions/[id]  { active_seconds } - Timer heartbeat
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const id = (await params).id;
    const body = await request.json();
    const seconds = Math.floor(Number(body.active_seconds));
    if (!Number.isFinite(seconds) || seconds < 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }

    const session = await prisma.training_session.findFirst({
      where: {
        id,
        user_id: resolved.session.user.id,
        profile_id: resolved.profileId,
        status: "in_progress",
      },
      select: { active_seconds: true },
    });
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });

    const next = Math.min(seconds, session.active_seconds + MAX_HEARTBEAT_STEP);
    if (next > session.active_seconds) {
      await prisma.training_session.update({ where: { id }, data: { active_seconds: next } });
    }
    return NextResponse.json({ active_seconds: Math.max(next, session.active_seconds) });
  } catch (error) {
    console.error("Error updating training session timer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
