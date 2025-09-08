"use client";

import { RulesDialog } from "@/components/rules-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

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
}
interface DictationHeaderProps {
  dictation: {
    topic: Topic;
    count_words: number | null;
    dictations_levels: DictationLevel[];
  };
}

export default function DicteeHeader({ dictation }: DictationHeaderProps) {
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
        <h1 className="text-3xl font-bold text-gray-900">
          {dictation.topic.name}
        </h1>
        <RulesDialog
          rulesExplanationMessage={dictation.topic.rules_explanation_message}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-2">
        {dictation.count_words && (
          <Badge variant="outline" className="text-gray-600">
            {dictation.count_words} mots
          </Badge>
        )}
        <div className="flex flex-wrap gap-2">
          {dictation.dictations_levels.map((dl) => (
            <Badge
              key={dl.id}
              className="bg-teal-400 text-white border-teal-400 hover:bg-teal-500"
            >
              {dl.levels.code}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
