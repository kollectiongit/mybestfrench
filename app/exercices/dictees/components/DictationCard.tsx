"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Topic {
  id: number;
  name: string;
  category: {
    name: string;
  };
}

export interface Dictation {
  id: number;
  title: string;
  count_words: number | null;
  topic: Topic;
  levels: string[];
  audio_files: string[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
  highest_success_percentage: number | null;
}

export default function DictationCard({ dictation }: { dictation: Dictation }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Link href={`/exercices/dictees/${dictation.id}`} rel="noopener noreferrer">
      <Card
        className={`overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer pt-0 pb-2 gap-0 flex flex-col h-[180px] hover:scale-[1.02] ${
          dictation.attempts_count > 0 ? "border-green-200 bg-green-50/30" : ""
        }`}
      >
        <CardContent className="p-4 flex flex-col justify-between flex-1">
          <div className="mb-4">
            <CardTitle className="text-md line-clamp-2 mb-3">
              {dictation.title}
            </CardTitle>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between">
            {/* 1st row: Category and Topic */}
            <div className="flex flex-wrap gap-1">
              {dictation.topic.category.name && (
                <Badge className="text-xs">
                  {dictation.topic.category.name}
                </Badge>
              )}
              {dictation.topic.name && (
                <Badge className="text-xs bg-gray-500">
                  {dictation.topic.name}
                </Badge>
              )}
              {dictation.levels.map((level, index) => (
                <Badge key={index} className="text-xs bg-gray-500">
                  {level}
                </Badge>
              ))}
            </div>

            {/* 2nd row: Sentences, Words, and Level */}
            <div className="flex flex-wrap gap-1 mb-4">
              <Badge variant="outline" className="text-xs ">
                {dictation.sentences_count}{" "}
                {dictation.sentences_count === 1 ? "phrase" : "phrases"}
              </Badge>
              {dictation.count_words && (
                <Badge variant="outline" className="text-xs">
                  {dictation.count_words} mots
                </Badge>
              )}
            </div>

            {/* 3rd row: Attempts, Errors, Success Percentage, and Date */}
            {dictation.attempts_count > 0 && (
              <div className="flex flex-wrap gap-1 text-xs text-green-500">
                <span>
                  {dictation.attempts_count}{" "}
                  {dictation.attempts_count === 1 ? "essai" : "essais"}
                </span>
                {dictation.errors_range && (
                  <span>
                    {" "}
                    • {dictation.errors_range}{" "}
                    {dictation.errors_range === "1" ? "erreur" : "erreurs"}
                  </span>
                )}
                {dictation.highest_success_percentage !== null && (
                  <span>
                    {" "}
                    • {dictation.highest_success_percentage}% réussite
                  </span>
                )}
                {dictation.latest_attempt_at && (
                  <span> • {formatDate(dictation.latest_attempt_at)}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
