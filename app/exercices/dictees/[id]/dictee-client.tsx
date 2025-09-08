"use client";

import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { DicteeAnalysis } from "@/lib/dictation-schema";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AttemptsTimeline from "./components/attempts-timeline";
import DicteeAudio from "./components/dictee-audio";
import DicteeEditor from "./components/dictee-editor";
import DicteeHeader from "./components/dictee-header";
import ValidationResults from "./components/validation-results";

interface Level {
  id: number;
  code: string;
  label: string;
  rank: number;
}

interface DictationLevel {
  id: number;
  level_id: number;
  dictation_id: string;
  levels: Level;
}

interface Topic {
  id: number;
  name: string;
  slug: string;
  rules_explanation_message: string | null;
  category: {
    id: number;
    name: string;
    slug: string;
  };
}

interface ExerciceAttempt {
  id: string;
  created_at: string | null;
  correction_total_errors: number | null;
  correction_errors_spelling: number | null;
  correction_errors_grammar: number | null;
  correction_errors_conjugation: number | null;
  correction_errors_percentage: number | null;
  correction_full_json: string | null;
  user_answer: string | null;
}

interface Dictation {
  id: string;
  topic_id: number;
  original_text: string | null;
  audio_file: string | null;
  screenshot_file: string | null;
  picture_file: string | null;
  count_words: number | null;
  created_at: string;
  updated_at: string;
  topic: Topic;
  dictations_levels: DictationLevel[];
  exercicesAttempts: ExerciceAttempt[];
}

export default function DicteeClient({ dictationId }: { dictationId: string }) {
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
      <DicteeAudio audioFile={dictation.audio_file} />
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
