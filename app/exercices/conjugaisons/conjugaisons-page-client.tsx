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
import { ArrowRight, CheckCircle2, History, Table, XCircle } from "lucide-react";
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
  groupe: number | null;
  radical: string;
  hasRadical: boolean;
}

// Couleur du badge selon le groupe : 1er=bleu, 2è=jaune, 3è=orange
const GROUPE_STYLES: Record<number, { label: string; className: string }> = {
  1: { label: "1er groupe", className: "bg-blue-100 text-blue-700 border-blue-300" },
  2: { label: "2e groupe", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  3: { label: "3e groupe", className: "bg-orange-100 text-orange-700 border-orange-300" },
};

interface RandomResponse {
  conjugaison: Conjugaison | null;
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
  // Conjugaison préchargée en arrière-plan pour un passage instantané au suivant
  const nextRef = useRef<RandomResponse | null>(null);
  const prefetchingRef = useRef(false);

  // Récupère une conjugaison sans toucher à l'état d'affichage
  const fetchConjugaison = useCallback(
    async (excludeId?: number): Promise<RandomResponse> => {
      const url = excludeId
        ? `/api/conjugaisons/random?exclude=${excludeId}`
        : "/api/conjugaisons/random";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Erreur de chargement");
      }
      return (await res.json()) as RandomResponse;
    },
    []
  );

  // Précharge la conjugaison suivante en arrière-plan (en excluant celle affichée)
  const prefetchNext = useCallback(
    async (excludeId?: number) => {
      if (prefetchingRef.current) return;
      prefetchingRef.current = true;
      try {
        nextRef.current = await fetchConjugaison(excludeId);
      } catch (e) {
        console.error(e);
        nextRef.current = null;
      } finally {
        prefetchingRef.current = false;
      }
    },
    [fetchConjugaison]
  );

  // Affiche une conjugaison déjà chargée et relance le préchargement de la suivante
  const showConjugaison = useCallback(
    (json: RandomResponse) => {
      setResult(null);
      setAnswer("");
      setData(json);
      nextRef.current = null;
      prefetchNext(json.conjugaison?.id);
    },
    [prefetchNext]
  );

  // Passe à la conjugaison suivante : instantané si elle est préchargée
  const goToNext = useCallback(
    async (currentId?: number) => {
      const prefetched = nextRef.current;
      if (prefetched && prefetched.conjugaison) {
        showConjugaison(prefetched);
        return;
      }
      // Pas de préchargement disponible : chargement classique
      setLoading(true);
      setResult(null);
      setAnswer("");
      try {
        const json = await fetchConjugaison(currentId);
        setData(json);
        nextRef.current = null;
        prefetchNext(json.conjugaison?.id);
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger une conjugaison.");
      } finally {
        setLoading(false);
      }
    },
    [fetchConjugaison, prefetchNext, showConjugaison]
  );

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await fetchConjugaison();
        if (cancelled) return;
        setData(json);
        prefetchNext(json.conjugaison?.id);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Impossible de charger une conjugaison.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchConjugaison, prefetchNext]);

  // Focus sur le champ quand une nouvelle conjugaison apparaît
  useEffect(() => {
    if (data && !result) {
      inputRef.current?.focus();
    }
  }, [data, result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !data.conjugaison || submitting || result) return;
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
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/exercices/conjugaisons/historique">
              <History className="size-4" /> Mon historique
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/exercices/conjugaisons/tableau">
              <Table className="size-4" /> Tableau de résultats
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Chargement…</p>
        </div>
      ) : !data || !data.conjugaison ? (
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
          <CardHeader className="text-center space-y-3 pb-2">
            {data.conjugaison.groupe &&
              GROUPE_STYLES[data.conjugaison.groupe] && (
                <div className="flex justify-center">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${
                      GROUPE_STYLES[data.conjugaison.groupe].className
                    }`}
                  >
                    {GROUPE_STYLES[data.conjugaison.groupe].label}
                  </Badge>
                </div>
              )}
            <CardTitle className="text-4xl font-extrabold tracking-tight">
              {data.conjugaison.infinitif}
            </CardTitle>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {data.conjugaison.personne}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {data.conjugaison.temps}
              </Badge>
            </div>
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
              <div className="flex items-center justify-center gap-x-5 gap-y-2 text-2xl font-semibold flex-wrap">
                <span className="text-muted-foreground">
                  {data.conjugaison.hasRadical
                    ? data.conjugaison.personne
                    : pronomAffiche(data.conjugaison.personne, answer).trim()}
                </span>
                {data.conjugaison.hasRadical ? (
                  <label
                    className={`flex items-center h-12 w-56 rounded-md border border-input bg-transparent px-3 text-2xl shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] ${
                      !!result || submitting ? "opacity-50" : "cursor-text"
                    }`}
                  >
                    <span className="text-gray-400 select-none">
                      {data.conjugaison.radical}
                    </span>
                    <input
                      ref={inputRef}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={!!result || submitting}
                      className="flex-1 min-w-0 border-0 bg-transparent p-0 text-gray-800 outline-none disabled:cursor-not-allowed"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </label>
                ) : (
                  <Input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={!!result || submitting}
                    className="w-56 text-2xl h-12"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
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
                  onClick={() => goToNext(data.conjugaison?.id)}
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
