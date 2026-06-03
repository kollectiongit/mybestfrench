"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Dumbbell, RotateCcw, Table, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Attempt {
  id: number;
  created_at: string | null;
  is_correct: boolean;
  user_answer: string | null;
  correct_answer: string | null;
  infinitif: string;
  personne: string;
  temps: string;
  groupe: number | null;
  radical: string;
}

const ALL = "all";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ConjugaisonsHistoryClient() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const [fVerbe, setFVerbe] = useState(ALL);
  const [fTemps, setFTemps] = useState(ALL);
  const [fPersonne, setFPersonne] = useState(ALL);
  const [fGroupe, setFGroupe] = useState(ALL);
  const [fResultat, setFResultat] = useState(ALL);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/conjugaisons/history");
        if (!res.ok) throw new Error("Erreur de chargement");
        const json = await res.json();
        setAttempts(json.attempts ?? []);
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger l'historique.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Options dynamiques basées sur les données
  const verbes = useMemo(
    () => Array.from(new Set(attempts.map((a) => a.infinitif))).sort(),
    [attempts]
  );
  const temps = useMemo(
    () => Array.from(new Set(attempts.map((a) => a.temps))).sort(),
    [attempts]
  );
  const personnes = useMemo(
    () => Array.from(new Set(attempts.map((a) => a.personne))),
    [attempts]
  );
  const groupes = useMemo(
    () =>
      Array.from(new Set(attempts.map((a) => a.groupe).filter((g): g is number => g != null))).sort(),
    [attempts]
  );

  const filtered = useMemo(() => {
    return attempts.filter((a) => {
      if (fVerbe !== ALL && a.infinitif !== fVerbe) return false;
      if (fTemps !== ALL && a.temps !== fTemps) return false;
      if (fPersonne !== ALL && a.personne !== fPersonne) return false;
      if (fGroupe !== ALL && String(a.groupe) !== fGroupe) return false;
      if (fResultat === "correct" && !a.is_correct) return false;
      if (fResultat === "incorrect" && a.is_correct) return false;
      return true;
    });
  }, [attempts, fVerbe, fTemps, fPersonne, fGroupe, fResultat]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const correct = filtered.filter((a) => a.is_correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, pct };
  }, [filtered]);

  const resetFilters = () => {
    setFVerbe(ALL);
    setFTemps(ALL);
    setFPersonne(ALL);
    setFGroupe(ALL);
    setFResultat(ALL);
  };

  const handleDelete = async (id: number) => {
    // Suppression optimiste : on retire la carte tout de suite
    const previous = attempts;
    setAttempts((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/conjugaisons/history/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur de suppression");
    } catch (e) {
      console.error(e);
      setAttempts(previous);
      toast.error("Impossible de supprimer cet essai.");
    }
  };

  const hasActiveFilter =
    fVerbe !== ALL ||
    fTemps !== ALL ||
    fPersonne !== ALL ||
    fGroupe !== ALL ||
    fResultat !== ALL;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Historique de conjugaison</h1>
          <p className="text-muted-foreground mt-1">
            Toutes les conjugaisons que tu as réalisées.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/exercices/conjugaisons">
              <Dumbbell className="size-4" /> S&apos;entraîner
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/exercices/conjugaisons/tableau">
              <Table className="size-4" /> Tableau de résultats
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Essais</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
          <div className="text-xs text-muted-foreground">Réussis</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{stats.pct}%</div>
          <div className="text-xs text-muted-foreground">Réussite</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={fVerbe} onValueChange={setFVerbe}>
          <SelectTrigger className="w-auto min-w-[130px]">
            <SelectValue placeholder="Verbe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les verbes</SelectItem>
            {verbes.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fTemps} onValueChange={setFTemps}>
          <SelectTrigger className="w-auto min-w-[130px]">
            <SelectValue placeholder="Temps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les temps</SelectItem>
            {temps.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fPersonne} onValueChange={setFPersonne}>
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Personne" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les personnes</SelectItem>
            {personnes.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fGroupe} onValueChange={setFGroupe}>
          <SelectTrigger className="w-auto min-w-[110px]">
            <SelectValue placeholder="Groupe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les groupes</SelectItem>
            {groupes.map((g) => (
              <SelectItem key={g} value={String(g)}>
                {g}
                {g === 1 ? "er" : "e"} groupe
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fResultat} onValueChange={setFResultat}>
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Résultat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les résultats</SelectItem>
            <SelectItem value="correct">Réussis</SelectItem>
            <SelectItem value="incorrect">Ratés</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
            <RotateCcw className="size-4" /> Réinitialiser
          </Button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {attempts.length === 0
            ? "Tu n'as pas encore réalisé de conjugaison."
            : "Aucune conjugaison ne correspond à ces filtres."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`group flex items-center gap-3 rounded-lg border p-3 ${
                a.is_correct ? "" : "bg-red-50 border-red-300"
              }`}
            >
              {a.is_correct ? (
                <CheckCircle2 className="size-5 text-green-600 shrink-0" />
              ) : (
                <XCircle className="size-5 text-red-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.infinitif}</span>
                  <Badge variant="secondary" className="text-xs">
                    {a.personne}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {a.temps}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Ta réponse :{" "}
                  <span className={a.is_correct ? "text-green-700" : "text-red-700"}>
                    {a.user_answer ? a.radical + a.user_answer : "—"}
                  </span>
                  {!a.is_correct && a.correct_answer && (
                    <>
                      {" · "}Correct :{" "}
                      <span className="font-medium">{a.correct_answer}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0 text-right">
                {formatDate(a.created_at)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(a.id)}
                aria-label="Supprimer cet essai"
                className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
