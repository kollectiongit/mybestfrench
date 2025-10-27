"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DicteeAnalysis } from "@/lib/dictation-schema";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

// Helper function to parse highlighted text and match errors to explanations
function buildErrorTooltipMap(
  errors: Array<{
    order: number;
    wrong: string;
    right: string;
    type: string;
    explication: string;
  }>
): Map<string, string> {
  const errorMap = new Map<string, string>();

  errors.forEach((error) => {
    // Extract individual words from the wrong text (split by spaces and get words with **)
    const wordsWithMarkdown = error.wrong.match(/\*\*[^*]+\*\*/g);
    if (wordsWithMarkdown) {
      wordsWithMarkdown.forEach((word) => {
        const cleanWord = word.replace(/\*\*/g, "").toLowerCase();
        errorMap.set(cleanWord, error.explication);
      });
    } else {
      // Fallback: use the whole clean text if no bold markers found
      const cleanWrong = error.wrong.replace(/\*\*/g, "").toLowerCase();
      errorMap.set(cleanWrong, error.explication);
    }
  });

  return errorMap;
}

// Component for error word with tooltip
function ErrorWithTooltip({
  children,
  explanation,
}: {
  children: React.ReactNode;
  explanation?: string;
}) {
  if (!explanation) {
    return (
      <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
        {children}
      </strong>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <strong className="text-red-600 bg-red-100 px-1 rounded font-bold cursor-help underline decoration-dotted">
          {children}
        </strong>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-gray-900 text-white p-3"
      >
        <div className="text-sm">
          <ReactMarkdown
            components={{
              strong: ({ children }) => (
                <strong className="text-red-400 font-bold">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="text-green-400 font-bold not-italic">
                  {children}
                </em>
              ),
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            }}
          >
            {explanation}
          </ReactMarkdown>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface StreamingValidationResultsProps {
  userAnswer: string;
  originalText: string;
  partialAnalysis: Partial<DicteeAnalysis>;
  isStreaming: boolean;
  error?: string;
}

// Loading skeleton component
function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}

// Stats loading skeleton
function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="text-center p-3 bg-white rounded">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
        </div>
      ))}
    </div>
  );
}

export default function StreamingValidationResults({
  userAnswer,
  originalText,
  partialAnalysis,
  isStreaming,
  error,
}: StreamingValidationResultsProps) {
  const [showStats, setShowStats] = useState(false);
  const [showHighlightedSubmitted, setShowHighlightedSubmitted] =
    useState(false);
  const [showHighlightedOriginal, setShowHighlightedOriginal] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showFautes, setShowFautes] = useState(false);
  const [showConclusion, setShowConclusion] = useState(false);
  const [errorTooltipMap, setErrorTooltipMap] = useState<Map<string, string>>(
    new Map()
  );

  // Animate sections as they become available
  useEffect(() => {
    if (partialAnalysis.stats) {
      setTimeout(() => setShowStats(true), 100);
    }
    if (partialAnalysis.dictation_submitted_errors_highlighted) {
      setTimeout(() => setShowHighlightedSubmitted(true), 200);
    }
    if (partialAnalysis.original_text_errors_highlighted) {
      setTimeout(() => setShowHighlightedOriginal(true), 300);
    }
    if (partialAnalysis.message_general) {
      setTimeout(() => setShowMessage(true), 400);
    }
    if (partialAnalysis.fautes && partialAnalysis.fautes.length > 0) {
      setTimeout(() => setShowFautes(true), 500);
    }
    if (partialAnalysis.conclusion_positive) {
      setTimeout(() => setShowConclusion(true), 600);
    }
  }, [partialAnalysis]);

  // Build error tooltip map when data is available
  useEffect(() => {
    if (partialAnalysis.errors && partialAnalysis.errors.length > 0) {
      const map = buildErrorTooltipMap(partialAnalysis.errors);
      setErrorTooltipMap(map);
    }
  }, [partialAnalysis.errors]);

  return (
    <div className="mt-8 p-6 bg-gray-50 rounded-lg">
      {/* User's answer and correct text side by side */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-blue-600">
            Ta dictée
          </h3>
          <div className="p-4 bg-white rounded border-blue-200 border-1 h-fit">
            {partialAnalysis.dictation_submitted_errors_highlighted ? (
              <div
                className={`transition-opacity duration-500 ${showHighlightedSubmitted ? "opacity-100" : "opacity-0"} text-gray-700`}
              >
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => {
                      const childText = String(children);
                      // Remove markdown from highlighted text for matching
                      const cleanText = childText
                        .replace(/\*\*/g, "")
                        .toLowerCase();
                      const explanation = errorTooltipMap.get(cleanText);
                      return (
                        <ErrorWithTooltip explanation={explanation}>
                          {children}
                        </ErrorWithTooltip>
                      );
                    },
                    em: ({ children }) => (
                      <strong className="text-green-600 bg-green-100 px-1 rounded font-bold">
                        {children}
                      </strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside ml-4">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside ml-4">
                        {children}
                      </ol>
                    ),
                  }}
                >
                  {partialAnalysis.dictation_submitted_errors_highlighted}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap animate-pulse">
                {userAnswer}
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2 text-green-500">
            Version correcte
          </h3>
          <div className="p-4 bg-white rounded border-green-200 border-1 h-fit">
            {partialAnalysis.original_text_errors_highlighted ? (
              <div
                className={`transition-opacity duration-500 ${showHighlightedOriginal ? "opacity-100" : "opacity-0"} text-gray-700`}
              >
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <strong className="text-green-600 bg-green-100 px-1 rounded font-bold">
                        {children}
                      </strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside ml-4">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside ml-4">
                        {children}
                      </ol>
                    ),
                  }}
                >
                  {partialAnalysis.original_text_errors_highlighted}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap animate-pulse">
                {originalText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Bilan global</h3>
        {partialAnalysis.stats ? (
          <div
            className={`transition-opacity duration-500 ${showStats ? "opacity-100" : "opacity-0"}`}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-red-600">
                  {partialAnalysis.stats.total_fautes}
                </div>
                <div className="text-sm text-gray-600">Total fautes</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {partialAnalysis.stats.fautes_orthographe}
                </div>
                <div className="text-sm text-gray-600">Orthographe</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {partialAnalysis.stats.fautes_grammaire}
                </div>
                <div className="text-sm text-gray-600">Grammaire</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {partialAnalysis.stats.fautes_conjugaison}
                </div>
                <div className="text-sm text-gray-600">Conjugaison</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(partialAnalysis.stats.pourcentage_reussite)}%
                </div>
                <div className="text-sm text-gray-600">Mots corrects</div>
              </div>
            </div>
          </div>
        ) : (
          <StatsLoadingSkeleton />
        )}
      </div>

      {/* Message general section */}
      {partialAnalysis.message_general ? (
        <div
          className={`my-12 transition-opacity duration-500 ${showMessage ? "opacity-100" : "opacity-0"}`}
        >
          <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
            <p className="text-gray-700 font-bold">
              {partialAnalysis.message_general}
            </p>
          </div>
        </div>
      ) : isStreaming && !error ? (
        <div className="my-12">
          <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
            <LoadingSkeleton />
          </div>
        </div>
      ) : null}

      {/* Fautes section */}
      {partialAnalysis.fautes && partialAnalysis.fautes.length > 0 ? (
        <div
          className={`mb-6 transition-opacity duration-500 ${showFautes ? "opacity-100" : "opacity-0"}`}
        >
          <h2 className="text-3xl font-bold mb-4">Correction de ta dictée</h2>
          <div className="space-y-4">
            {partialAnalysis.fautes.map((faute, index: number) => (
              <div key={index} className="p-4 bg-white rounded border relative">
                <div className="absolute top-4 right-4">
                  <Badge variant="outline">
                    Phrase #{faute.sentence_order_number}
                  </Badge>
                </div>
                <div className="mb-2 flex flex-row gap-2">
                  <Badge variant="destructive" className="bg-red-500">
                    Ta version
                  </Badge>
                  <div className="text-gray-700">
                    <ReactMarkdown
                      components={{
                        strong: ({ children }) => (
                          <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <strong className="text-green-600 bg-green-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside ml-4">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside ml-4">
                            {children}
                          </ol>
                        ),
                      }}
                    >
                      {faute.texte_eleve}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="mb-2 flex flex-row gap-2">
                  <Badge variant="destructive" className="bg-green-500">
                    Correction
                  </Badge>
                  <div className="text-gray-700">
                    <ReactMarkdown
                      components={{
                        strong: ({ children }) => (
                          <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <strong className="text-green-600 bg-green-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside ml-4">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside ml-4">
                            {children}
                          </ol>
                        ),
                      }}
                    >
                      {faute.correction}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="mb-2">
                  <Badge className="font-semibold mt-4 mb-2">Explication</Badge>
                  <div className="text-gray-700">
                    <ReactMarkdown
                      components={{
                        strong: ({ children }) => (
                          <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <strong className="text-green-600 bg-green-100 px-1 rounded font-bold">
                            {children}
                          </strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside ml-4">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside ml-4">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="py-1">{children}</li>
                        ),
                      }}
                    >
                      {faute.explication}
                    </ReactMarkdown>
                  </div>
                </div>
                <div>
                  <Badge className="font-semibold mt-4 mb-2">Règle</Badge>
                  <div className="text-gray-700">
                    <ReactMarkdown
                      components={{
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside ml-4">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside ml-4">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="py-1">{children}</li>
                        ),
                      }}
                    >
                      {faute.regle}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isStreaming && !error ? (
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-4">Correction de ta dictée</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white rounded border">
              <LoadingSkeleton className="h-20" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Conclusion section */}
      {partialAnalysis.conclusion_positive ? (
        <div
          className={`transition-opacity duration-500 ${showConclusion ? "opacity-100" : "opacity-0"}`}
        >
          <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
            <h3 className="text-lg font-semibold mb-2 text-green-800">
              Conclusion
            </h3>
            <p className="text-green-700">
              {partialAnalysis.conclusion_positive}
            </p>
          </div>
        </div>
      ) : isStreaming && !error ? (
        <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
          <h3 className="text-lg font-semibold mb-2 text-green-800">
            Conclusion
          </h3>
          <LoadingSkeleton />
        </div>
      ) : null}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 rounded border-l-4 border-red-500">
          <h3 className="text-lg font-semibold mb-2 text-red-800">Erreur</h3>
          <p className="text-red-700">{error}</p>
          {partialAnalysis.stats && (
            <p className="text-red-600 text-sm mt-2">
              Les résultats partiels sont affichés ci-dessus.
            </p>
          )}
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && !error && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
            Analyse en cours...
          </div>
        </div>
      )}
    </div>
  );
}
