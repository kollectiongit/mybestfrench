"use client";

import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { DicteeAnalysis } from "@/lib/dictation-schema";
import { ArrowLeftIcon, Pause, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addFavoriteDictation,
  removeFavoriteDictation,
} from "../actions";

import AttemptsTimeline from "./components/attempts-timeline";
import DicteeEditor from "./components/dictee-editor";
import DicteeHeader from "./components/dictee-header";
import DicteeSentencesAudio from "./components/dictee-sentences-audio";
import StreamingValidationResults from "./components/streaming-validation-results";

interface Level {
  code: string;
}

interface DictationLevel {
  levels: Level;
}

interface Topic {
  id: number;
  name: string;
  rules_explanation_message: string | null;
  category: {
    id: number;
    name: string;
  };
}

interface ExerciceAttempt {
  id: number;
  created_at: Date | null;
  correction_total_errors: number | null;
  correction_errors_spelling: number | null;
  correction_errors_grammar: number | null;
  correction_errors_conjugation: number | null;
  correction_success_percentage: number | null;
  correction_full_json: string | null;
  user_answer: string | null;
  question_text: string | null;
  correction_user_answer_errors_highlighted: string | null;
  original_text_errors_highlighted: string | null;
}

interface DictationSentence {
  audio_file: string;
  order: number;
  text: string;
}

interface Dictation {
  original_text: string | null;
  title: string;
  picture_file: string | null;
  count_words: number | null;
  topic: Topic;
  dictations_levels: DictationLevel[];
  dictation_sentences: DictationSentence[];
  _count: {
    dictation_sentences: number;
  };
  exercicesAttempts: ExerciceAttempt[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: Date | null;
  exercices_attempts_min_errors: number | null;
  exercices_attempts_max_errors: number | null;
  is_favorite: boolean;
}

export default function DicteeClient({ dictationId }: { dictationId: number }) {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const router = useRouter();

  const [dictation, setDictation] = useState<Dictation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessageIndex, setValidationMessageIndex] = useState(0);
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(
    null
  );
  const [streamingAnalysis, setStreamingAnalysis] =
    useState<Partial<DicteeAnalysis> | null>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [isFavoriteAnimating, setIsFavoriteAnimating] = useState(false);
  const favoriteAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const { value: dictationText, setValue: setDictationText } = useAutosave("", {
    key: dictationId ? `dictation-${dictationId}` : "",
    debounceMs: 500,
    enabled: !!dictationId,
  });

  const validationMessages = useMemo(
    () => [
      "Correction de la dictée...",
      "Vérification de l'orthographe...",
      "Vérification de la grammaire...",
      "Vérification de la conjugaison...",
      "Calcul de la note...",
      "Rédaction de la correction...",
    ],
    []
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isValidating) {
      interval = setInterval(() => {
        setValidationMessageIndex(
          (prev) => (prev + 1) % validationMessages.length
        );
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isValidating, validationMessages.length]);

  useEffect(() => {
    if (!profileLoading && profile === null) {
      const timer = setTimeout(() => {
        if (!profileLoading && profile === null) {
          router.push("/profiles?message=profile-required");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile, profileLoading, router]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/dictations/${dictationId}`);
        if (!res.ok) {
          setError(
            res.status === 404
              ? "Dictée non trouvée"
              : "Erreur lors du chargement de la dictée"
          );
          return;
        }
        const data: Dictation = await res.json();
        setDictation(data);
      } catch {
        setError("Erreur lors du chargement de la dictée");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [dictationId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (dictation?.topic?.name) {
      document.title = `${dictation.topic.name} | My Best French`;
    } else {
      document.title = "Dictée | My Best French";
    }
  }, [dictation?.topic?.name]);

  useEffect(
    () => () => {
      if (favoriteAnimationTimeout.current) {
        clearTimeout(favoriteAnimationTimeout.current);
      }
    },
    []
  );

  const handleToggleFavorite = useCallback(async () => {
    if (!dictation || !profile) return;

    const previousDictation = dictation;
    const nextFavorite = !dictation.is_favorite;

    setDictation({ ...dictation, is_favorite: nextFavorite });

    if (favoriteAnimationTimeout.current) {
      clearTimeout(favoriteAnimationTimeout.current);
      favoriteAnimationTimeout.current = null;
    }

    if (nextFavorite) {
      setIsFavoriteAnimating(true);
      favoriteAnimationTimeout.current = setTimeout(() => {
        setIsFavoriteAnimating(false);
        favoriteAnimationTimeout.current = null;
      }, 800);
    } else {
      setIsFavoriteAnimating(false);
    }

    setIsFavoritePending(true);

    try {
      if (nextFavorite) {
        await addFavoriteDictation(dictationId, profile.id);
      } else {
        await removeFavoriteDictation(dictationId, profile.id);
      }
    } catch (error) {
      console.error("Error toggling favorite dictation:", error);
      setDictation(previousDictation);
      if (favoriteAnimationTimeout.current) {
        clearTimeout(favoriteAnimationTimeout.current);
        favoriteAnimationTimeout.current = null;
      }
      setIsFavoriteAnimating(false);
    } finally {
      setIsFavoritePending(false);
    }
  }, [dictation, dictationId, profile]);

  const handleValidate = async () => {
    if (
      !dictationId ||
      !dictationText.trim() ||
      !dictation?.original_text ||
      !profile?.age
    )
      return;

    setIsValidating(true);
    setStreamingAnalysis({});
    setStreamingError(null);

    try {
      const levelsCodes =
        profile.profile_levels?.map((pl) => pl.levels.code).join(", ") || "";

      const response = await fetch(`/api/dictations/${dictationId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dictationId,
          studentText: dictationText,
          originalText: dictation.original_text,
          profileAge: profile.age,
          profileFirstName: profile.first_name,
          profileDescription: profile.description,
          profileLevels: levelsCodes,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "delta") {
                // Update with partial data directly
                if (data.partial) {
                  setStreamingAnalysis((prev) => ({
                    ...prev,
                    ...data.partial,
                  }));
                }
              } else if (data.type === "complete") {
                // Final result received
                if (data.analysis && data.attempt && dictation) {
                  const newAttempt: ExerciceAttempt = {
                    id: data.attempt.id,
                    created_at: data.attempt.created_at,
                    correction_total_errors:
                      data.attempt.correction_total_errors,
                    correction_errors_spelling:
                      data.attempt.correction_errors_spelling,
                    correction_errors_grammar:
                      data.attempt.correction_errors_grammar,
                    correction_errors_conjugation:
                      data.attempt.correction_errors_conjugation,
                    correction_success_percentage:
                      data.attempt.correction_success_percentage,
                    correction_full_json: data.attempt.correction_full_json,
                    user_answer: data.attempt.user_answer,
                    question_text: data.attempt.question_text,
                    correction_user_answer_errors_highlighted:
                      data.attempt.correction_user_answer_errors_highlighted,
                    original_text_errors_highlighted:
                      data.attempt.original_text_errors_highlighted,
                  };

                  setDictation({
                    ...dictation,
                    exercicesAttempts: [
                      newAttempt,
                      ...dictation.exercicesAttempts,
                    ],
                  });

                  // Set the new attempt as expanded
                  setExpandedAttemptId(newAttempt.id);
                }

                // Clear streaming state
                setStreamingAnalysis(null);
                setStreamingError(null);
                setDictationText("");
              } else if (data.type === "error") {
                setStreamingError(data.error);
              } else if (data.type === "refusal") {
                setStreamingError(
                  "Le modèle a refusé de traiter cette demande"
                );
              }
            } catch (parseError) {
              console.error("Error parsing SSE data:", parseError);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error validating dictation:", err);
      setStreamingError("Erreur lors de l'analyse de la dictée");
    } finally {
      setIsValidating(false);
    }
  };

  if (profileLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de la dictée...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  if (error || !dictation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || "Dictée non trouvée"}
          </h1>
          <Button asChild variant="ghost">
            <Link
              href="/exercices/dictees"
              className="inline-flex items-center"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Retour aux dictées
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 md:px-4 py-8 max-w-4xl">
      <DicteeHeader
        dictation={dictation}
        onToggleFavorite={handleToggleFavorite}
        isFavoritePending={isFavoritePending}
        isFavoriteAnimating={isFavoriteAnimating}
        favoriteDisabled={!profile}
      />
      <DicteeSentencesAudio
        dictationSentences={dictation.dictation_sentences}
      />

      {/* Shortcut Buttons */}
      <div className="hidden md:flex flex-wrap gap-2 mb-6 bg-green-50 rounded-lg p-3">
        <Button variant="outline">
          Précédente phrase
          <kbd className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            ⌘←
          </kbd>
        </Button>

        <Button variant="outline">
          Prochaine phrase
          <kbd className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            ⌘→
          </kbd>
        </Button>
        <Button variant="outline">
          <Repeat
            className="-ms-1 me-2 opacity-60"
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
          Loop
          <kbd className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            ⌘↑
          </kbd>
        </Button>

        <Button variant="outline">
          <Pause
            className="-ms-1 me-2 opacity-60"
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
          Pause
          <kbd className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            ⌘↓
          </kbd>
        </Button>
      </div>

      <DicteeEditor
        pictureFile={dictation.picture_file}
        topicName={dictation.topic.name}
        dictationText={dictationText}
        setDictationText={setDictationText}
        disabled={false}
        isValidating={isValidating}
        validationMessage={validationMessages[validationMessageIndex]}
        onValidate={handleValidate}
      />

      {/* Show streaming results during validation */}
      {streamingAnalysis && (
        <StreamingValidationResults
          userAnswer={dictationText}
          originalText={dictation.original_text || ""}
          partialAnalysis={streamingAnalysis}
          isStreaming={isValidating}
          error={streamingError || undefined}
        />
      )}

      <AttemptsTimeline
        dictation={dictation}
        hasContent={
          dictationText.trim().length > 0 || streamingAnalysis !== null
        }
        expandedAttemptId={expandedAttemptId}
        onExpandedChange={setExpandedAttemptId}
      />
    </div>
  );
}
