"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle2, History, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PreviousAttempt {
  is_correct: boolean;
  user_answer: string | null;
  created_at: string | null;
}

interface Conjugaison {
  id: number;
  infinitif: string;
  personne: string;
  temps: string;
  radical: string;
  hasRadical: boolean;
}

interface RandomResponse {
  conjugaison: Conjugaison;
  previousAttempts: PreviousAttempt[];
}

interface ValidateResponse {
  isCorrect: boolean;
  correctAnswer: string;
}

const VOYELLES = ["a", "e", "i", "o", "u", "é", "è", "ê", "h"];

// Affiche le pronom sujet avec élision de "je" devant une voyelle (j').
function pronomAffiche(personne: string, formeApres: string): string {
  if (personne === "je" && formeApres && VOYELLES.includes(formeApres[0].toLowerCase())) {
    return "j'";
  }
  return personne + " ";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ConjugaisonsPageClient() {
  const [data, setData] = useState<RandomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadConjugaison = useCallback(async (excludeId?: number) => {
    setLoading(true);
    setResult(null);
    setAnswer("");
    try {
      const url = excludeId
        ? `/api/conjugaisons/random?exclude=${excludeId}`
        : "/api/conjugaisons/random";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Erreur de chargement");
      }
      const json: RandomResponse = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de charger une conjugaison.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConjugaison();
  }, [loadConjugaison]);

  // Focus sur le champ quand une nouvelle conjugaison apparaît
  useEffect(() => {
    if (data && !result) {
      inputRef.current?.focus();
    }
  }, [data, result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || submitting || result) return;
    if (answer.trim() === "") {
      toast.error("Écris ta réponse avant de valider.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/conjugaisons/${data.conjugaison.id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer: answer }),
      });
      if (!res.ok) {
        throw new Error("Erreur de validation");
      }
      const json: ValidateResponse = await res.json();
      setResult(json);
      if (json.isCorrect) {
        toast.success("Bravo, c'est la bonne réponse ! 🎉");
      } else {
        toast.error("Ce n'est pas la bonne réponse.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Une erreur est survenue lors de la validation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Conjugaison</h1>
        <p className="text-muted-foreground mt-2">
          Conjugue le verbe à la bonne personne et au bon temps.
        </p>
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/exercices/conjugaisons/historique">
              <History className="size-4" /> Voir mon historique
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Chargement…</p>
        </div>
      ) : !data ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucune conjugaison disponible.</p>
        </div>
      ) : (
        <Card
          className={
            result
              ? result.isCorrect
                ? "bg-green-50 border-green-300 transition-colors"
                : "bg-red-50 border-red-300 transition-colors"
              : "transition-colors"
          }
        >
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-center gap-2 text-center">
              <Badge variant="secondary" className="text-sm">
                {data.conjugaison.personne}
              </Badge>
              <span className="text-xl font-bold">{data.conjugaison.infinitif}</span>
              <Badge variant="outline" className="text-sm">
                {data.conjugaison.temps}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Historique des essais précédents */}
            {data.previousAttempts.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Tu as déjà répondu à cette conjugaison :
                </p>
                {data.previousAttempts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {a.is_correct ? (
                      <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="size-4 text-red-600 shrink-0" />
                    )}
                    <span className={a.is_correct ? "text-green-700" : "text-red-700"}>
                      {a.is_correct ? "Bonne réponse" : "Mauvaise réponse"}
                    </span>
                    <span className="text-muted-foreground">
                      le {formatDate(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Saisie */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-center gap-1 text-2xl font-semibold flex-wrap">
                {data.conjugaison.hasRadical ? (
                  <>
                    <span>{data.conjugaison.personne}</span>
                    <span className="text-primary">{data.conjugaison.radical}</span>
                    <Input
                      ref={inputRef}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={!!result || submitting}
                      placeholder="terminaison"
                      className="w-40 text-2xl h-12"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </>
                ) : (
                  <>
                    <span>{pronomAffiche(data.conjugaison.personne, answer)}</span>
                    <Input
                      ref={inputRef}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={!!result || submitting}
                      placeholder="forme conjuguée"
                      className="w-56 text-2xl h-12"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </>
                )}
              </div>

              {!result && (
                <div className="flex justify-center">
                  <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? "Validation…" : "Soumettre"}
                  </Button>
                </div>
              )}
            </form>

            {/* Résultat */}
            {result && (
              <div
                className={`rounded-lg border p-4 text-center ${
                  result.isCorrect
                    ? "border-green-300 bg-green-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                {result.isCorrect ? (
                  <p className="text-green-700 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-5" /> {"Bravo, c'est correct !"}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-red-700 font-semibold flex items-center justify-center gap-2">
                      <XCircle className="size-5" /> {"Ce n'est pas correct."}
                    </p>
                    <p className="text-red-700">
                      La bonne réponse était :{" "}
                      <span className="font-bold">
                        {pronomAffiche(
                          data.conjugaison.personne,
                          result.correctAnswer
                        )}
                        {result.correctAnswer}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="flex justify-center">
                <Button
                  onClick={() => loadConjugaison(data.conjugaison.id)}
                  size="lg"
                  variant="default"
                  className="gap-2"
                >
                  Conjugaison suivante <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
