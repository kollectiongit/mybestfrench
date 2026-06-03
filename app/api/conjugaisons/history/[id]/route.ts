import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = "force-dynamic";

// DELETE /api/conjugaisons/history/[id] - Supprime un essai de conjugaison du profil courant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentProfileId = await getCurrentProfileFromCookie(request);
    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: currentProfileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isInteger(attemptId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const result = await prisma.exercices_attempts.deleteMany({
      where: { id: attemptId, profile_id: currentProfileId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conjugaison attempt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
