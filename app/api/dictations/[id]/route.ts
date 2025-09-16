import { auth } from "@/lib/auth";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/dictations/[id] - Fetch single dictation by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dictationId = Number(id);

    if (!id || Number.isNaN(dictationId)) {
      return NextResponse.json(
        { error: "Dictation ID is required" },
        { status: 400 }
      );
    }

    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get current profile from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);

    const dictation = await prisma.dictation.findUnique({
      where: {
        id: dictationId,
      },
      select: {
        original_text: true,
        title: true,
        picture_file: true,
        count_words: true,
        topic: {
          select: {
            id: true,
            name: true,
            rules_explanation_message: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        dictations_levels: {
          select: {
            levels: {
              select: {
                code: true,
              },
            },
          },
        },
        dictation_sentences: {
          select: {
            audio_file: true,
            order:true,
            text:true,
          },
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            dictation_sentences: true,
          },
        },
      },
    });

    if (!dictation) {
      return NextResponse.json(
        { error: "Dictation not found" },
        { status: 404 }
      );
    }

    // Fetch exercices_attempts for this dictation and current profile
    let exercicesAttempts: Array<{
      id: number;
      created_at: Date | null;
      correction_total_errors: number | null;
      correction_errors_spelling: number | null;
      correction_errors_grammar: number | null;
      correction_errors_conjugation: number | null;
      correction_success_percentage: number | null;
      correction_full_json: string | null;
      user_answer: string | null;
    }> = [];
    let attemptsCount = 0;
    let latestAttemptAt: Date | null = null;
    let minErrors: number | null = null;
    let maxErrors: number | null = null;

    if (currentProfileId) {
      // Get all attempts
      exercicesAttempts = await prisma.exercices_attempts.findMany({
        where: {
          dictation_id: dictationId,
          profile_id: currentProfileId,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          created_at: true,
          correction_total_errors: true,
          correction_errors_spelling: true,
          correction_errors_grammar: true,
          correction_errors_conjugation: true,
          correction_success_percentage: true,
          correction_full_json: true,
          user_answer: true,
        },
      });

      // Get count, min, max errors and latest attempt
      const attemptsStats = await prisma.exercices_attempts.aggregate({
        where: {
          dictation_id: dictationId,
          profile_id: currentProfileId,
        },
        _count: true,
        _min: {
          correction_total_errors: true,
        },
        _max: {
          correction_total_errors: true,
        },
      });

      attemptsCount = attemptsStats._count;
      minErrors = attemptsStats._min.correction_total_errors;
      maxErrors = attemptsStats._max.correction_total_errors;
      latestAttemptAt = exercicesAttempts.length > 0 ? exercicesAttempts[0].created_at : null;
    }

    return NextResponse.json({
      ...dictation,
      exercicesAttempts,
      sentences_count: dictation._count.dictation_sentences,
      attempts_count: attemptsCount,
      latest_attempt_at: latestAttemptAt,
      exercices_attempts_min_errors: minErrors,
      exercices_attempts_max_errors: maxErrors,
    });
  } catch (error) {
    console.error("Error fetching dictation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
