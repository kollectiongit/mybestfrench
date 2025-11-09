// No caching here: always fetch fresh data for SSR page
import { prisma } from "./prisma";

// Interface pour les données pré-chargées
export interface DictationData {
  id: number;
  title: string;
  count_words: number | null;
  topic: {
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
    };
  };
  levels: string[];
  audio_files: string[];
  dictation_sentences: string[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
  highest_success_percentage: number | null;
  is_favorite: boolean;
}

// Types Prisma pour éviter les 'any'
interface PrismaDictationData {
  id: number;
  title: string;
  count_words: number | null;
  topic: {
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
    };
  };
  dictations_levels: Array<{
    levels: {
      code: string;
    };
  }>;
  dictation_sentences: Array<{
    audio_file: string | null;
    text: string;
  }>;
  exercices_attempts: Array<{
    created_at: Date | null;
    correction_total_errors: number | null;
    correction_success_percentage: number | null;
  }>;
  favorite_profiles: Array<{
    id: number;
  }>;
  _count: {
    dictation_sentences: number;
    exercices_attempts: number;
  };
}

/**
 * Internal function to fetch dictations from database
 */
async function fetchDictationsFromDB(profileId: string, profileLevelIds: number[]): Promise<DictationData[]> {
  if (profileLevelIds.length === 0) {
    return [];
  }

  // Récupérer les dictées qui correspondent aux niveaux du profil
  const dictationsData = await prisma.dictation.findMany({
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
      favorite_profiles: {
        where: {
          profile_id: profileId,
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
          profile_id: profileId,
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
              profile_id: profileId,
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

  // Transformer les données
  const dictations = dictationsData.map((dictation: PrismaDictationData) => {
    const attemptsCount = dictation._count.exercices_attempts;
    const sentencesCount = dictation._count.dictation_sentences;
    const latestAttempt = dictation.exercices_attempts.length > 0 
      ? dictation.exercices_attempts[0].created_at
      : null;

    // Calculate min and max correction errors from fetched attempts
    const correctionErrors = dictation.exercices_attempts
      .map((attempt) => attempt.correction_total_errors)
      .filter((error) => error !== null && error !== undefined);
    
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
      .map((attempt) => attempt.correction_success_percentage)
      .filter((percentage) => percentage !== null && percentage !== undefined);
    
    const highestSuccessPercentage = successPercentages.length > 0 
      ? Math.max(...successPercentages) 
      : null;

    const isFavorite = dictation.favorite_profiles.length > 0;
    const sentenceTexts = dictation.dictation_sentences
      .map((ds) => ds.text)
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
      levels: dictation.dictations_levels.map((dl) => dl.levels.code),
      audio_files: dictation.dictation_sentences.map((ds) => ds.audio_file).filter((file): file is string => file !== null),
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
  return dictations.sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1;
    }
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
}

/**
 * Récupère les dictées côté serveur pour un profil donné (with caching)
 */
export async function getDictationsForProfile(profileId: string, profileLevelIds: number[]): Promise<DictationData[]> {
  return fetchDictationsFromDB(profileId, profileLevelIds);
}
