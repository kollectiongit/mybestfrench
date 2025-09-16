import { auth } from "@/lib/auth";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/dictations - Fetch dictations filtered by current profile levels
export async function GET(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current profile ID from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);
    
    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    // Verify the profile belongs to the user and get its levels
    const profile = await prisma.profiles.findFirst({
      where: {
        id: currentProfileId,
        user_id: session.user.id,
      },
      include: {
        profile_levels: {
          select: {
            level_id: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Extract level IDs from profile
    const profileLevelIds = profile.profile_levels.map(pl => pl.level_id);

    // If no levels are set for the profile, return empty array
    if (profileLevelIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch dictations that have at least one level in common with the profile
    const dictations = await prisma.dictation.findMany({
      where: {
        dictations_levels: {
          some: {
            level_id: {
              in: profileLevelIds,
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        count_words: true,
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
      const attemptsCount = dictation.exercices_attempts.length;
      const sentencesCount = dictation.dictation_sentences.length;
      const latestAttempt = dictation.exercices_attempts.length > 0 
        ? Math.max(...dictation.exercices_attempts.map(attempt => 
            new Date(attempt.created_at!).getTime()
          ))
        : null;

      // Calculate min and max correction errors
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
        sentences_count: sentencesCount,
        attempts_count: attemptsCount,
        latest_attempt_at: latestAttempt ? new Date(latestAttempt).toISOString() : null,
        errors_range: errorsRange,
      };
    });

    // Sort by exercices_attempts.created_at desc, then by category.id, topic.id, title
    const sortedDictations = dictationsWithStats.sort((a, b) => {
      // First sort by latest attempt date (desc)
      const aLatestAttempt = a.latest_attempt_at ? new Date(a.latest_attempt_at).getTime() : 0;
      const bLatestAttempt = b.latest_attempt_at ? new Date(b.latest_attempt_at).getTime() : 0;
      
      if (aLatestAttempt !== bLatestAttempt) {
        return bLatestAttempt - aLatestAttempt; // desc
      }
      
      // Then by category.id (asc)
      if (a.topic.category.id !== b.topic.category.id) {
        return a.topic.category.id - b.topic.category.id;
      }
      
      // Then by topic.id (asc)
      if (a.topic.id !== b.topic.id) {
        return a.topic.id - b.topic.id;
      }
      
      // Finally by title (asc)
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json(sortedDictations);
  } catch (error) {
    console.error("Error fetching dictations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
