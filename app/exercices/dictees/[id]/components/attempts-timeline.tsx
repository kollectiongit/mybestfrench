"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DeleteAttemptDialog from "./delete-attempt-dialog";
import ValidationResults from "./validation-results";

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
interface Dictation {
  exercicesAttempts: ExerciceAttempt[];
}

function formatDateTime(dateString: Date | null) {
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
  if (errorCount === null) return "Erreur";
  if (errorCount === 0) return "Tout bon 🥳";
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
  hasContent = false,
  expandedAttemptId,
  onExpandedChange,
}: {
  dictation: Dictation;
  hasContent?: boolean;
  expandedAttemptId?: number | null;
  onExpandedChange?: (id: number | null) => void;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attempts, setAttempts] = useState(dictation.exercicesAttempts);

  // Update attempts when dictation changes (e.g., new attempt added)
  useEffect(() => {
    setAttempts(dictation.exercicesAttempts);
  }, [dictation.exercicesAttempts]);

  // Scroll to the expanded attempt
  useEffect(() => {
    if (expandedAttemptId) {
      // Wait for the accordion to expand
      setTimeout(() => {
        const element = document.querySelector(
          `[data-state="open"][data-radix-collection-item]`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);
    }
  }, [expandedAttemptId]);

  if (!attempts || attempts.length === 0) return null;

  const handleDeleteClick = (attemptId: number) => {
    setAttemptToDelete(attemptId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attemptToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/attempts/${attemptToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete attempt");
      }

      // Remove the attempt from local state
      setAttempts((prev) =>
        prev.filter((attempt) => attempt.id !== attemptToDelete)
      );

      // Show success message
      toast.success("Dictée supprimée");

      // Close dialog
      setDeleteDialogOpen(false);
      setAttemptToDelete(null);
    } catch (error) {
      console.error("Error deleting attempt:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setAttemptToDelete(null);
  };

  return (
    <div className="mt-12">
      {hasContent && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 Les corrections précédentes sont masquées pendant que vous
            écrivez votre dictée.
          </p>
        </div>
      )}
      <div className={hasContent ? "pointer-events-none opacity-50" : ""}>
        <Accordion
          type="single"
          collapsible
          className="w-full"
          value={expandedAttemptId ? `attempt-${expandedAttemptId}` : undefined}
          onValueChange={(value) => {
            if (onExpandedChange) {
              // Extract the ID from the value string (e.g., "attempt-123" -> 123)
              const id = value ? parseInt(value.replace("attempt-", "")) : null;
              onExpandedChange(id);
            }
          }}
        >
          {attempts.map((attempt) => (
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
                          Orthographe ({attempt.correction_errors_spelling || 0}
                          ). Grammaire ({attempt.correction_errors_grammar || 0}
                          ). Conjugaison (
                          {attempt.correction_errors_conjugation || 0})
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <Badge
                      className={`${getScoreBadgeStyle(attempt.correction_success_percentage)} w-16 text-center`}
                    >
                      {formatScore(attempt.correction_success_percentage)}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-4">
                  {attempt.correction_full_json ? (
                    (() => {
                      try {
                        const analysis = JSON.parse(
                          attempt.correction_full_json
                        );
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
                              {formatScore(
                                attempt.correction_success_percentage
                              )}
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
                        {formatScore(attempt.correction_success_percentage)}
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

                  {/* Delete button */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(attempt.id)}
                      disabled={hasContent}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteAttemptDialog
        isOpen={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </div>
  );
}
