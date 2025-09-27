import { PrismaClient } from "../../app/generated/prisma";

const prisma = new PrismaClient();

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
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
  highest_success_percentage: number | null;
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
  }>;
  exercices_attempts: Array<{
    created_at: Date | null;
    correction_total_errors: number | null;
    correction_success_percentage: number | null;
  }>;
}

/**
 * Récupère les dictées côté serveur pour un profil donné
 */
export async function getDictationsForProfile(profileId: string, profileLevelIds: number[]): Promise<DictationData[]> {
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
          profile_id: profileId,
        },
        select: {
          created_at: true,
          correction_total_errors: true,
          correction_success_percentage: true,
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
    const attemptsCount = dictation.exercices_attempts.length;
    const sentencesCount = dictation.dictation_sentences.length;
    const latestAttempt = dictation.exercices_attempts.length > 0 
      ? Math.max(...dictation.exercices_attempts.map(attempt => 
          new Date(attempt.created_at!).getTime()
        ))
      : null;

    // Calculer la plage d'erreurs
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

    // Calculer le pourcentage de réussite le plus élevé
    const successPercentages = dictation.exercices_attempts
      .map(attempt => attempt.correction_success_percentage)
      .filter(percentage => percentage !== null && percentage !== undefined);
    
    const highestSuccessPercentage = successPercentages.length > 0 
      ? Math.max(...successPercentages) 
      : null;

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
      audio_files: dictation.dictation_sentences.map(ds => ds.audio_file).filter((file): file is string => file !== null),
      sentences_count: sentencesCount,
      attempts_count: attemptsCount,
      latest_attempt_at: latestAttempt ? new Date(latestAttempt).toISOString() : null,
      errors_range: errorsRange,
      highest_success_percentage: highestSuccessPercentage,
    };
  });

  // Trier par date de dernière tentative (desc), puis par catégorie, sujet, titre
  return dictations.sort((a, b) => {
    const aLatestAttempt = a.latest_attempt_at ? new Date(a.latest_attempt_at).getTime() : 0;
    const bLatestAttempt = b.latest_attempt_at ? new Date(b.latest_attempt_at).getTime() : 0;
    
    if (aLatestAttempt !== bLatestAttempt) {
      return bLatestAttempt - aLatestAttempt;
    }
    
    if (a.topic.category.id !== b.topic.category.id) {
      return a.topic.category.id - b.topic.category.id;
    }
    
    if (a.topic.id !== b.topic.id) {
      return a.topic.id - b.topic.id;
    }
    
    return a.title.localeCompare(b.title);
  });
}
