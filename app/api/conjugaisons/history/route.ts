import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = "force-dynamic";

// GET /api/conjugaisons/history - Liste tous les essais de conjugaison du profil courant
export async function GET(request: NextRequest) {
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

    const attempts = await prisma.exercices_attempts.findMany({
      where: { profile_id: currentProfileId, conjugaison_id: { not: null } },
      orderBy: { created_at: "desc" },
      include: { conjugaison: true },
    });

    return NextResponse.json({
      attempts: attempts.map((a) => ({
        id: a.id,
        created_at: a.created_at?.toISOString() ?? null,
        is_correct: a.is_correct,
        user_answer: a.user_answer,
        correct_answer: a.correct_answer,
        infinitif: a.conjugaison?.infinitif ?? "",
        personne: a.conjugaison?.personne ?? "",
        temps: a.conjugaison?.temps ?? "",
        groupe: a.conjugaison?.groupe ?? null,
        radical: a.conjugaison?.radical ?? "",
      })),
    });
  } catch (error) {
    console.error("Error fetching conjugaison history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
