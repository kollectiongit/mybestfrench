"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, Heart } from "lucide-react";
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
    is_favorite: boolean;
  };
  onToggleFavorite?: () => void;
  isFavoritePending?: boolean;
  isFavoriteAnimating?: boolean;
  favoriteDisabled?: boolean;
}

export default function DicteeHeader({
  dictation,
  onToggleFavorite,
  isFavoritePending = false,
  isFavoriteAnimating = false,
  favoriteDisabled = false,
}: DictationHeaderProps) {
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

  const handleFavoriteClick = () => {
    if (favoriteDisabled || isFavoritePending) return;
    onToggleFavorite?.();
  };

  const FavoriteButton = (
    <button
      type="button"
      aria-label={
        dictation.is_favorite
          ? "Retirer la dictée des favoris"
          : "Ajouter la dictée aux favoris"
      }
      aria-pressed={dictation.is_favorite}
      onClick={handleFavoriteClick}
      disabled={favoriteDisabled || isFavoritePending}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-white/90 shadow-sm transition-all duration-200 hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400 ${
        favoriteDisabled || isFavoritePending
          ? "opacity-60 cursor-not-allowed"
          : ""
      }`}
    >
      <Heart
        className={`h-5 w-5 transition-transform duration-200 ${
          dictation.is_favorite ? "text-red-500" : "text-gray-400"
        } ${isFavoriteAnimating ? "scale-110" : ""} ${
          isFavoritePending ? "animate-pulse" : ""
        }`}
        strokeWidth={1.75}
        fill={dictation.is_favorite ? "currentColor" : "transparent"}
      />
    </button>
  );

  return (
    <div className="mb-8">
      {/* Mobile: buttons in same row with space-between */}
      <div className="flex justify-between items-center mb-6 md:hidden gap-3">
        <Button asChild variant="ghost" className="flex-1 justify-start">
          <Link href="/exercices/dictees" className="inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Retour aux dictées
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <RulesDialog
            rulesExplanationMessage={dictation.topic.rules_explanation_message}
          />
          {FavoriteButton}
        </div>
      </div>

      {/* Desktop: back button alone, then title with rules */}
      <div className="hidden md:block mb-6">
        <Button asChild variant="ghost">
          <Link href="/exercices/dictees" className="inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Retour aux dictées
          </Link>
        </Button>
      </div>
      <div className="flex justify-between items-center mb-4 gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{dictation.title}</h1>
        <div className="hidden md:flex items-center gap-2">
          <RulesDialog
            rulesExplanationMessage={dictation.topic.rules_explanation_message}
          />
          {FavoriteButton}
        </div>
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
      </div>

      {/* Sentences and words count on new row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
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
