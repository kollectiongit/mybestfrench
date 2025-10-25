import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = 'force-dynamic';

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

    // Create cache key
    const cacheKey = `dictation-${dictationId}-${currentProfileId || 'no-profile'}`;

    const dictation = await unstable_cache(
      async () => {
        return await prisma.dictation.findUnique({
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
            order: true,
            text: true,
          },
          orderBy: {
            order: "asc",
          },
        },
        exercices_attempts: {
          where: currentProfileId ? {
            profile_id: currentProfileId,
          } : undefined,
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
          orderBy: {
            created_at: 'desc',
          },
          take: 10, // Limit to latest 10 attempts for performance
        },
        _count: {
          select: {
            dictation_sentences: true,
            exercices_attempts: currentProfileId ? {
              where: {
                profile_id: currentProfileId,
              },
            } : true,
          },
        },
      },
    });
      },
      [cacheKey],
      {
        tags: ['dictation', `dictation-${dictationId}`, currentProfileId ? `profile-${currentProfileId}` : 'no-profile'],
        revalidate: 300, // Cache for 5 minutes (shorter because attempts change frequently)
      }
    )();

    if (!dictation) {
      return NextResponse.json(
        { error: "Dictation not found" },
        { status: 404 }
      );
    }

    // Calculate stats from the fetched data
    const exercicesAttempts = dictation.exercices_attempts || [];
    const attemptsCount = dictation._count.exercices_attempts;
    const latestAttemptAt = exercicesAttempts.length > 0 ? exercicesAttempts[0].created_at : null;
    
    // Calculate min and max errors from fetched attempts
    const correctionErrors = exercicesAttempts
      .map(attempt => attempt.correction_total_errors)
      .filter(error => error !== null && error !== undefined);
    
    const minErrors = correctionErrors.length > 0 ? Math.min(...correctionErrors) : null;
    const maxErrors = correctionErrors.length > 0 ? Math.max(...correctionErrors) : null;

    return NextResponse.json({
      ...dictation,
      exercicesAttempts,
      sentences_count: dictation._count.dictation_sentences,
      attempts_count: attemptsCount,
      latest_attempt_at: latestAttemptAt,
      exercices_attempts_min_errors: minErrors,
      exercices_attempts_max_errors: maxErrors,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error("Error fetching dictation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
