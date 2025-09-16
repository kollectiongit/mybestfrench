"use client";

import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { DicteeAnalysis } from "@/lib/dictation-schema";
import { ArrowLeftIcon, Pause, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AttemptsTimeline from "./components/attempts-timeline";
import DicteeEditor from "./components/dictee-editor";
import DicteeHeader from "./components/dictee-header";
import DicteeSentencesAudio from "./components/dictee-sentences-audio";
import ValidationResults from "./components/validation-results";

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
}

export default function DicteeClient({ dictationId }: { dictationId: number }) {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const router = useRouter();

  const [dictation, setDictation] = useState<Dictation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<DicteeAnalysis | null>(null);
  const [validationMessageIndex, setValidationMessageIndex] = useState(0);

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

  const handleValidate = async () => {
    if (
      !dictationId ||
      !dictationText.trim() ||
      !dictation?.original_text ||
      !profile?.age
    )
      return;

    setIsValidating(true);
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
      if (response.ok) {
        const result = await response.json();
        setValidationResult(result.analysis);
        setDictationText("");
      } else {
        console.error(
          "Validation failed:",
          response.status,
          await response.text()
        );
      }
    } catch (err) {
      console.error("Error validating dictation:", err);
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <DicteeHeader dictation={dictation} />
      <DicteeSentencesAudio
        dictationSentences={dictation.dictation_sentences}
      />

      {/* Shortcut Buttons */}
      <div className="flex flex-wrap gap-2 mb-6 bg-green-50 rounded-lg p-3">
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
        disabled={!!validationResult}
        isValidating={isValidating}
        validationMessage={validationMessages[validationMessageIndex]}
        onValidate={handleValidate}
      />
      <AttemptsTimeline dictation={dictation} />
      {validationResult && (
        <ValidationResults
          analysis={validationResult}
          userAnswer={dictationText}
        />
      )}
    </div>
  );
}
