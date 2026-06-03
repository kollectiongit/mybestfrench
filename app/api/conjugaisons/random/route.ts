import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Auth
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Profil courant
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

    // Tirage aléatoire parmi les ids des groupes choisis pour ce profil
    const excludeParam = request.nextUrl.searchParams.get("exclude");
    const excludeId = excludeParam ? parseInt(excludeParam, 10) : null;

    const groupes = profile.conjugaison_groupes ?? [1, 2, 3];
    if (groupes.length === 0) {
      // Aucun groupe sélectionné → rien à proposer
      return NextResponse.json({ conjugaison: null, previousAttempts: [] });
    }

    const allIds = await prisma.conjugaison.findMany({
      where: { groupe: { in: groupes } },
      select: { id: true },
    });
    if (allIds.length === 0) {
      return NextResponse.json({ conjugaison: null, previousAttempts: [] });
    }

    let candidates = allIds.map((c) => c.id);
    if (excludeId && candidates.length > 1) {
      candidates = candidates.filter((id) => id !== excludeId);
    }
    const randomId = candidates[Math.floor(Math.random() * candidates.length)];

    const conjugaison = await prisma.conjugaison.findUnique({
      where: { id: randomId },
    });
    if (!conjugaison) {
      return NextResponse.json({ error: "Conjugaison not found" }, { status: 404 });
    }

    // Essais précédents de ce profil pour cette conjugaison
    const previousAttempts = await prisma.exercices_attempts.findMany({
      where: { profile_id: currentProfileId, conjugaison_id: conjugaison.id },
      orderBy: { created_at: "desc" },
      select: { is_correct: true, user_answer: true, created_at: true },
    });

    // Réglage profil : afficher le radical ou non
    const showRadical = profile.conjugaison_show_radical ?? true;
    const effectiveHasRadical = showRadical && conjugaison.radical !== "";

    // Ne pas divulguer verbe_conjugue / terminaison au client
    return NextResponse.json({
      conjugaison: {
        id: conjugaison.id,
        infinitif: conjugaison.infinitif,
        personne: conjugaison.personne,
        temps: conjugaison.temps,
        groupe: conjugaison.groupe,
        radical: effectiveHasRadical ? conjugaison.radical : "",
        hasRadical: effectiveHasRadical,
      },
      previousAttempts: previousAttempts.map((a) => ({
        is_correct: a.is_correct,
        user_answer: a.user_answer,
        created_at: a.created_at?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Error fetching random conjugaison:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
