"use client";

import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DicteeAnalysis } from "@/lib/dictation-schema";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Component for error word with tooltip (desktop) and drawer (mobile)
function ErrorWithTooltip({
  children,
  explanation,
}: {
  children: React.ReactNode;
  explanation?: string;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const scrollPositionRef = useRef(0);

  const handleOpenChange = (open: boolean) => {
    if (typeof window !== "undefined" && open) {
      scrollPositionRef.current = window.scrollY;
    }
    setIsDrawerOpen(open);
  };

  useEffect(() => {
    if (!isDrawerOpen || typeof window === "undefined") {
      return;
    }

    const restoreScroll = () => {
      window.scrollTo({
        top: scrollPositionRef.current,
        left: 0,
      });
    };

    const rafId = window.requestAnimationFrame(restoreScroll);
    const timeoutId = window.setTimeout(restoreScroll, 0);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [isDrawerOpen]);

  if (!explanation) {
    return (
      <strong className="text-red-600 bg-red-100 px-1 rounded font-bold">
        {children}
      </strong>
    );
  }

  // Split markdown content into plain text for title
  const getTitle = (text: string) => {
    const match = text.match(/\*\*([^*]+)\*\*/);
    return match ? match[1] : text.split(" ")[0];
  };

  return (
    <>
      {/* Desktop: Use Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild className="hidden md:inline">
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
                p: ({ children }) => (
                  <p className="mb-1 last:mb-0">{children}</p>
                ),
              }}
            >
              {explanation}
            </ReactMarkdown>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Mobile: Use Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild className="md:hidden">
          <button
            type="button"
            className="inline-flex items-center text-red-600 bg-red-100 px-1 rounded font-bold underline decoration-dotted cursor-pointer active:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <span className="font-bold">{children}</span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="pb-12">
          <DrawerHeader>
            <DrawerTitle className="text-left text-xl text-gray-800">
              Correction : {getTitle(explanation)}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="text-sm text-gray-500">
              <ReactMarkdown
                components={{
                  strong: ({ children }) => (
                    <strong className="text-red-400 font-bold">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-green-400 font-bold not-italic">
                      {children}
                    </em>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">{children}</p>
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
                {explanation}
              </ReactMarkdown>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default function ValidationResults({
  analysis,
  userAnswer,
}: {
  analysis: DicteeAnalysis;
  userAnswer?: string;
}) {
  // Build error map when data is available
  const errorTooltipMap = useMemo(() => {
    if (analysis.errors && analysis.errors.length > 0) {
      return buildErrorTooltipMap(analysis.errors);
    }
    return new Map<string, string>();
  }, [analysis.errors]);

  return (
    <div className="mt-8 py-6 px-3 md:p-6 bg-gray-50 rounded-lg ">
      {/* User's answer and correct text side by side */}
      {(userAnswer || analysis.originalText) && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {userAnswer && (
            <div>
              <h3 className="text-lg font-semibold mb-2 ">Ta dictée</h3>
              <div className="p-4 bg-white rounded border-blue-200 border-1 h-fit">
                {analysis.dictation_submitted_errors_highlighted ? (
                  <div className="text-gray-700">
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
                      {analysis.dictation_submitted_errors_highlighted}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {userAnswer}
                  </p>
                )}
              </div>
            </div>
          )}
          {analysis.originalText !== null &&
            analysis.originalText !== undefined && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Version correcte</h3>
                <div className="p-4 bg-white rounded border-green-200 border-1 h-fit">
                  {analysis.original_text_errors_highlighted ? (
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
                        {analysis.original_text_errors_highlighted}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {analysis.originalText}
                    </p>
                  )}
                </div>
              </div>
            )}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Bilan global</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-white rounded">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(analysis.stats.pourcentage_reussite)}%
            </div>
            <div className="text-sm text-gray-600">Réussite</div>
          </div>
          <div className="text-center p-3 bg-white rounded">
            <div className="text-2xl font-bold text-red-600">
              {analysis.stats.total_fautes}
            </div>
            <div className="text-sm  text-gray-600">Fautes</div>
          </div>
          <div className=" p-3 bg-transarent rounded block md:hidden"></div>
          <div className="text-center p-3 bg-white rounded">
            <div className="text-2xl font-bold text-red-600">
              {analysis.stats.fautes_orthographe}
            </div>
            <div className="text-sm text-gray-600">Orthographe</div>
          </div>
          <div className="text-center p-3 bg-white rounded">
            <div className="text-2xl font-bold text-red-600">
              {analysis.stats.fautes_grammaire}
            </div>
            <div className="text-sm text-gray-600">Grammaire</div>
          </div>
          <div className="text-center p-3 bg-white rounded">
            <div className="text-2xl font-bold text-red-600">
              {analysis.stats.fautes_conjugaison}
            </div>
            <div className="text-sm text-gray-600">Conjugaison</div>
          </div>
        </div>
      </div>

      {analysis.message_general && (
        <div className="my-12">
          <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
            <p className="text-gray-700 font-bold">
              {analysis.message_general}
            </p>
          </div>
        </div>
      )}

      {analysis.fautes && analysis.fautes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-4">Correction de ta dictée</h2>
          <div className="space-y-6">
            {analysis.fautes.map((faute, index: number) => (
              <div key={index}>
                <Badge variant="outline" className="mb-2 font-bolder">
                  Phrase #{faute.sentence_order_number}
                </Badge>
                <div className="p-4 bg-white rounded border">
                  <div className="mb-2 flex flex-col gap-2">
                    <Badge
                      variant="destructive"
                      className="bg-red-500 w-fit font-bolder!"
                    >
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
                  <div className="mb-2 mt-4 flex flex-col gap-2">
                    <Badge
                      variant="destructive"
                      className="bg-green-500 w-fit font-bolder"
                    >
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
                    <Badge className="font-semibold mt-4 mb-2 font-bolder">
                      Explication
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
                    <Badge className="font-semibold mt-4 mb-2 font-bolder!">
                      Règle
                    </Badge>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.conclusion_positive && (
        <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
          <h3 className="text-lg font-semibold mb-2 text-green-800">
            Conclusion
          </h3>
          <p className="text-green-700">{analysis.conclusion_positive}</p>
        </div>
      )}
    </div>
  );
}
