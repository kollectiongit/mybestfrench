"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ValidationResults from "./validation-results";

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
  exercicesAttempts: ExerciceAttempt[];
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return "Date inconnue";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScore(percentage: number | null) {
  if (percentage === null) return "N/A";
  return `${Math.round(percentage / 10)}/10`;
}

function formatErrorCount(errorCount: number | null) {
  if (errorCount === null) return "N/A erreurs";
  if (errorCount === 0) return "0 erreur 🥳";
  if (errorCount === 1) return "1 erreur";
  return `${errorCount} erreurs`;
}

function getScoreBadgeStyle(percentage: number | null) {
  if (percentage === null) return "bg-gray-500 hover:bg-gray-600";
  const score = Math.round(percentage / 10);
  if (score >= 0 && score <= 4) return "bg-red-500 hover:bg-red-600 text-white";
  if (score >= 5 && score <= 6)
    return "bg-orange-500 hover:bg-orange-600 text-white";
  if (score >= 7 && score <= 7)
    return "bg-yellow-500 hover:bg-yellow-600 text-white";
  if (score >= 8 && score <= 9)
    return "bg-blue-500 hover:bg-green-600 text-white";
  if (score === 10) return "bg-green-500 text-white";
  return "bg-gray-500 hover:bg-gray-600 text-white";
}

export default function AttemptsTimeline({
  dictation,
}: {
  dictation: Dictation;
}) {
  if (!dictation.exercicesAttempts || dictation.exercicesAttempts.length === 0)
    return null;

  return (
    <div className="mt-12">
      <Accordion type="single" collapsible className="w-full">
        {dictation.exercicesAttempts.map((attempt) => (
          <AccordionItem key={attempt.id} value={`attempt-${attempt.id}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDateTime(attempt.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className="cursor-help w-24 text-center"
                        >
                          {formatErrorCount(attempt.correction_total_errors)}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Orthographe ({attempt.correction_errors_spelling || 0}).
                        Grammaire ({attempt.correction_errors_grammar || 0}).
                        Conjugaison (
                        {attempt.correction_errors_conjugation || 0})
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge
                    className={`${getScoreBadgeStyle(attempt.correction_errors_percentage)} w-16 text-center`}
                  >
                    {formatScore(attempt.correction_errors_percentage)}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4">
                {attempt.correction_full_json ? (
                  (() => {
                    try {
                      const analysis = JSON.parse(attempt.correction_full_json);
                      return (
                        <ValidationResults
                          analysis={analysis}
                          userAnswer={attempt.user_answer || undefined}
                        />
                      );
                    } catch {
                      return (
                        <div className="text-sm text-gray-600">
                          <p className="mb-2">
                            <strong>Date:</strong>{" "}
                            {formatDateTime(attempt.created_at)}
                          </p>
                          <p className="mb-2">
                            <strong>Score:</strong>{" "}
                            {formatScore(attempt.correction_errors_percentage)}
                          </p>
                          <p className="mb-2">
                            <strong>Erreurs totales:</strong>{" "}
                            {attempt.correction_total_errors || 0}
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-red-50 p-2 rounded">
                              <strong>Orthographe:</strong>{" "}
                              {attempt.correction_errors_spelling || 0}
                            </div>
                            <div className="bg-blue-50 p-2 rounded">
                              <strong>Grammaire:</strong>{" "}
                              {attempt.correction_errors_grammar || 0}
                            </div>
                            <div className="bg-purple-50 p-2 rounded">
                              <strong>Conjugaison:</strong>{" "}
                              {attempt.correction_errors_conjugation || 0}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="text-sm text-gray-600">
                    <p className="mb-2">
                      <strong>Date:</strong>{" "}
                      {formatDateTime(attempt.created_at)}
                    </p>
                    <p className="mb-2">
                      <strong>Score:</strong>{" "}
                      {formatScore(attempt.correction_errors_percentage)}
                    </p>
                    <p className="mb-2">
                      <strong>Erreurs totales:</strong>{" "}
                      {attempt.correction_total_errors || 0}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-red-50 p-2 rounded">
                        <strong>Orthographe:</strong>{" "}
                        {attempt.correction_errors_spelling || 0}
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <strong>Grammaire:</strong>{" "}
                        {attempt.correction_errors_grammar || 0}
                      </div>
                      <div className="bg-purple-50 p-2 rounded">
                        <strong>Conjugaison:</strong>{" "}
                        {attempt.correction_errors_conjugation || 0}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
