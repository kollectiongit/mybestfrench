import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = "force-dynamic";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// POST /api/conjugaisons/[id]/validate - Soumet une réponse et enregistre l'essai
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conjugaisonId = Number(id);
    if (!id || Number.isNaN(conjugaisonId)) {
      return NextResponse.json({ error: "Conjugaison ID is required" }, { status: 400 });
    }

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

    const body = await request.json();
    const userAnswer: string = typeof body?.userAnswer === "string" ? body.userAnswer : "";

    const conjugaison = await prisma.conjugaison.findUnique({
      where: { id: conjugaisonId },
    });
    if (!conjugaison) {
      return NextResponse.json({ error: "Conjugaison not found" }, { status: 404 });
    }

    // Le radical n'est affiché que si le profil l'autorise ET que la conjugaison en a un.
    // Dans ce cas on n'attend que la terminaison ; sinon on attend la forme entière.
    const showRadical = profile.conjugaison_show_radical ?? true;
    const effectiveHasRadical = showRadical && conjugaison.radical !== "";
    const expected = effectiveHasRadical
      ? conjugaison.terminaison
      : conjugaison.verbe_conjugue;
    const isCorrect = normalize(userAnswer) === normalize(expected);

    await prisma.exercices_attempts.create({
      data: {
        user_id: session.user.id,
        profile_id: currentProfileId,
        conjugaison_id: conjugaison.id,
        question_type: "CONJUGAISON",
        question_text: `${conjugaison.infinitif} — ${conjugaison.personne} — ${conjugaison.temps}`,
        user_answer: userAnswer,
        is_correct: isCorrect,
        correct_answer: conjugaison.verbe_conjugue,
      },
    });

    return NextResponse.json({
      isCorrect,
      correctAnswer: conjugaison.verbe_conjugue,
    });
  } catch (error) {
    console.error("Error validating conjugaison:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
