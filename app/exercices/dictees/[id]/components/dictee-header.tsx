"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { RulesDialog } from "./rules-dialog";

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
interface DictationHeaderProps {
  dictation: {
    title: string;
    topic: Topic;
    count_words: number | null;
    dictations_levels: DictationLevel[];
    sentences_count: number;
    attempts_count: number;
    latest_attempt_at: Date | null;
    exercices_attempts_min_errors: number | null;
    exercices_attempts_max_errors: number | null;
  };
}

export default function DicteeHeader({ dictation }: DictationHeaderProps) {
  // Format latest attempt date
  const formatDate = (date: Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Format error range
  const formatErrorRange = () => {
    const { exercices_attempts_min_errors, exercices_attempts_max_errors } =
      dictation;

    if (
      exercices_attempts_min_errors === null ||
      exercices_attempts_max_errors === null
    ) {
      return null;
    }

    const maxErrors = Math.max(
      exercices_attempts_min_errors,
      exercices_attempts_max_errors
    );
    const errorText = maxErrors === 1 ? "erreur" : "erreurs";

    if (exercices_attempts_min_errors === exercices_attempts_max_errors) {
      return `${exercices_attempts_min_errors} ${errorText}`;
    }

    return `${exercices_attempts_min_errors} - ${exercices_attempts_max_errors} ${errorText}`;
  };

  return (
    <div className="mb-8">
      <div className="mb-6">
        <Button asChild variant="ghost">
          <Link href="/exercices/dictees" className="inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Retour aux dictées
          </Link>
        </Button>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">{dictation.title}</h1>
        <RulesDialog
          rulesExplanationMessage={dictation.topic.rules_explanation_message}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Category Badge */}
        <Badge variant="default">{dictation.topic.category.name}</Badge>

        {/* Topic Badge */}
        <Badge className="bg-gray-600 text-white">{dictation.topic.name}</Badge>

        <div className="flex flex-wrap gap-2">
          {dictation.dictations_levels.map((dl, index) => (
            <Badge key={index} className=" text-white bg-gray-600">
              {dl.levels.code}
            </Badge>
          ))}
        </div>

        {/* Sentences count */}
        <Badge variant="outline" className="text-gray-600">
          {dictation.sentences_count}{" "}
          {dictation.sentences_count === 1 ? "phrase" : "phrases"}
        </Badge>

        {/* Words count */}
        {dictation.count_words && (
          <Badge variant="outline" className="text-gray-600">
            {dictation.count_words} mots
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-green-500">
        {/* Attempts count */}
        {dictation.attempts_count > 1 && (
          <span>
            {dictation.attempts_count}{" "}
            {dictation.attempts_count === 1 ? "essai" : "essais"}
          </span>
        )}

        {/* Latest attempt date */}

        {dictation.latest_attempt_at && (
          <span>{formatDate(dictation.latest_attempt_at)}</span>
        )}
        {/* Error range */}
        {formatErrorRange() && <span>{formatErrorRange()}</span>}

        {/* Levels */}
      </div>
    </div>
  );
}
