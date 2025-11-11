import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// No route-level caching
export const revalidate = 0;
export const dynamic = 'force-dynamic';

// GET /api/dictations/favorites - Fetch favorite dictations for current profile
export async function GET(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve current profile: prefer middleware-propagated header, fallback to signed cookie
    const headerProfileId = request.headers.get('x-current-profile-id');
    const cookieProfileId = await getCurrentProfileFromCookie(request);
    const currentProfileId = headerProfileId || cookieProfileId;
    
    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    // Verify the profile belongs to the user
    const profile = await prisma.profiles.findFirst({
      where: {
        id: currentProfileId,
        user_id: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Fetch dictations that are favorited by the current profile
    const dictations = await prisma.dictation.findMany({
      where: {
        favorite_profiles: {
          some: {
            profile_id: currentProfileId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        count_words: true,
        favorite_profiles: {
          where: {
            profile_id: currentProfileId,
          },
          select: {
            id: true,
          },
        },
        topic: {
          select: {
            id: true,
            name: true,
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
            text: true,
          },
        },
        exercices_attempts: {
          where: {
            user_id: session.user.id,
            profile_id: currentProfileId,
          },
          select: {
            created_at: true,
            correction_total_errors: true,
            correction_success_percentage: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1, // Only get the latest attempt for sorting
        },
        _count: {
          select: {
            dictation_sentences: true,
            exercices_attempts: {
              where: {
                user_id: session.user.id,
                profile_id: currentProfileId,
              },
            },
          },
        },
      },
      orderBy: [
        {
          topic: {
            category: {
              id: "asc",
            },
          },
        },
        {
          topic: {
            id: "asc",
          },
        },
        {
          title: "asc",
        },
      ],
    });

    // Transform the data to include counts and latest attempt timestamp
    const dictationsWithStats = dictations.map(dictation => {
      const attemptsCount = dictation._count.exercices_attempts;
      const sentencesCount = dictation._count.dictation_sentences;
      const latestAttempt = dictation.exercices_attempts.length > 0 
        ? dictation.exercices_attempts[0].created_at
        : null;

      // Calculate min and max correction errors from fetched attempts
      const correctionErrors = dictation.exercices_attempts
        .map(attempt => attempt.correction_total_errors)
        .filter(error => error !== null && error !== undefined);
      
      let errorsRange = null;
      if (correctionErrors.length > 0) {
        const minError = Math.min(...correctionErrors);
        const maxError = Math.max(...correctionErrors);
        
        if (minError === maxError) {
          errorsRange = `${minError}`;
        } else {
          errorsRange = `${minError} à ${maxError}`;
        }
      }

      // Calculate highest success percentage from fetched attempts
      const successPercentages = dictation.exercices_attempts
        .map(attempt => attempt.correction_success_percentage)
        .filter(percentage => percentage !== null && percentage !== undefined);
      
      const highestSuccessPercentage = successPercentages.length > 0 
        ? Math.max(...successPercentages) 
        : null;

      const isFavorite = dictation.favorite_profiles.length > 0;
      const sentenceTexts = dictation.dictation_sentences
        .map(ds => ds.text)
        .filter((text): text is string => typeof text === "string" && text.length > 0);

      return {
        id: dictation.id,
        title: dictation.title,
        count_words: dictation.count_words,
        topic: {
          id: dictation.topic.id,
          name: dictation.topic.name,
          category: {
            id: dictation.topic.category.id,
            name: dictation.topic.category.name,
          },
        },
        levels: dictation.dictations_levels.map(dl => dl.levels.code),
        audio_files: dictation.dictation_sentences.map(ds => ds.audio_file).filter(Boolean),
        dictation_sentences: sentenceTexts,
        sentences_count: sentencesCount,
        attempts_count: attemptsCount,
        latest_attempt_at: latestAttempt ? new Date(latestAttempt).toISOString() : null,
        errors_range: errorsRange,
        highest_success_percentage: highestSuccessPercentage,
        is_favorite: isFavorite,
      };
    });

    // Sort by latest attempt date (descending) then by category/topic/title
    const sortedDictations = dictationsWithStats.sort((a, b) => {
      // Primary sort: by latest attempt date (descending)
      if (a.latest_attempt_at && b.latest_attempt_at) {
        const dateA = new Date(a.latest_attempt_at).getTime();
        const dateB = new Date(b.latest_attempt_at).getTime();
        return dateB - dateA;
      }
      
      // If one has attempts and the other doesn't, prioritize the one with attempts
      if (a.latest_attempt_at && !b.latest_attempt_at) return -1;
      if (!a.latest_attempt_at && b.latest_attempt_at) return 1;
      
      // Secondary sort: by category id
      if (a.topic.category.id !== b.topic.category.id) {
        return a.topic.category.id - b.topic.category.id;
      }
      
      // Tertiary sort: by topic id
      if (a.topic.id !== b.topic.id) {
        return a.topic.id - b.topic.id;
      }
      
      // Final sort: by title
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json(sortedDictations, {
      headers: {
        // Per-user/profile data; avoid public shared caching
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error("Error fetching favorite dictations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

