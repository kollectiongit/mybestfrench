"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dumbbell, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Cell {
  infinitif: string;
  groupe: number | null;
  temps: string;
  personne: string;
  total: number;
  success: number;
}

const ALL = "all";

const TEMPS_ORDER = ["présent", "imparfait", "futur simple", "passé composé"];
const TEMPS_LABELS: Record<string, string> = {
  présent: "Présent",
  imparfait: "Imparfait",
  "futur simple": "Futur",
  "passé composé": "Passé composé",
};
const PERSON_ORDER = ["je", "tu", "il", "nous", "vous", "elles"];

type CellState = "none" | "success" | "error";

function cellState(cell: Cell | undefined): CellState {
  if (!cell || cell.total === 0) return "none";
  if (cell.success > 0) return "success";
  return "error";
}

// Échelle de gris selon le taux de réussite (plus c'est foncé, meilleur c'est).
// Classes statiques complètes pour que le JIT Tailwind les détecte.
function pctColorClass(pct: number): string {
  if (pct >= 95) return "bg-gray-950 text-gray-50";
  if (pct >= 90) return "bg-gray-900 text-gray-50";
  if (pct >= 80) return "bg-gray-800 text-gray-50";
  if (pct >= 70) return "bg-gray-700 text-gray-50";
  if (pct >= 60) return "bg-gray-600 text-gray-50";
  if (pct >= 50) return "bg-gray-500 text-gray-50";
  if (pct >= 40) return "bg-gray-400 text-gray-900";
  if (pct >= 30) return "bg-gray-300 text-gray-900";
  if (pct >= 20) return "bg-gray-200 text-gray-900";
  return "bg-gray-100 text-gray-900";
}

interface Stat {
  key: string;
  label: string;
  total: number;
  success: number;
  pct: number | null;
}

function StatCard({ label, total, pct }: { label: string; total: number; pct: number | null }) {
  const cls = pct == null ? "bg-muted text-muted-foreground" : pctColorClass(pct);
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-lg font-bold leading-tight">
        {pct == null ? "—" : `${pct}%`}
      </div>
      <div className="text-[11px] opacity-70">
        {total} conjugaison{total > 1 ? "s" : ""}
      </div>
    </div>
  );
}

function StatSection({
  title,
  stats,
  gridClass,
}: {
  title: string;
  stats: Stat[];
  gridClass: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </div>
      <div className={`grid gap-2 ${gridClass}`}>
        {stats.map((s) => (
          <StatCard key={s.key} label={s.label} total={s.total} pct={s.pct} />
        ))}
      </div>
    </div>
  );
}

export default function ConjugaisonsTableClient() {
  const [cells, setCells] = useState<Cell[]>([]);
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
        const res = await fetch("/api/conjugaisons/table");
        if (!res.ok) throw new Error("Erreur de chargement");
        const json = await res.json();
        setCells(json.cells ?? []);
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger le tableau.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Index des cases : "infinitif|temps|personne" -> Cell
  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cells) {
      m.set(`${c.infinitif}|${c.temps}|${c.personne}`, c);
    }
    return m;
  }, [cells]);

  // Verbe -> groupe
  const verbeGroupe = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of cells) {
      if (!m.has(c.infinitif)) m.set(c.infinitif, c.groupe);
    }
    return m;
  }, [cells]);

  // Options de filtre
  const verbes = useMemo(
    () => Array.from(new Set(cells.map((c) => c.infinitif))).sort(),
    [cells]
  );
  const groupes = useMemo(
    () =>
      Array.from(
        new Set(cells.map((c) => c.groupe).filter((g): g is number => g != null))
      ).sort(),
    [cells]
  );

  // Colonnes / lignes visibles selon les filtres
  const visibleTemps = useMemo(
    () => TEMPS_ORDER.filter((t) => fTemps === ALL || t === fTemps),
    [fTemps]
  );
  const visiblePersonnes = useMemo(
    () => PERSON_ORDER.filter((p) => fPersonne === ALL || p === fPersonne),
    [fPersonne]
  );

  const matchesResultat = (state: CellState) => {
    if (fResultat === ALL) return true;
    if (fResultat === "correct") return state === "success";
    if (fResultat === "incorrect") return state === "error";
    return true;
  };

  const visibleVerbes = useMemo(() => {
    const candidates = verbes.filter((v) => {
      if (fVerbe !== ALL && v !== fVerbe) return false;
      if (fGroupe !== ALL && String(verbeGroupe.get(v)) !== fGroupe) return false;
      return true;
    });
    if (fResultat === ALL) return candidates;
    // Garder uniquement les verbes ayant au moins une case correspondant au filtre résultat
    return candidates.filter((v) =>
      visibleTemps.some((t) =>
        visiblePersonnes.some((p) => {
          const state = cellState(cellMap.get(`${v}|${t}|${p}`));
          return matchesResultat(state);
        })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    verbes,
    fVerbe,
    fGroupe,
    fResultat,
    verbeGroupe,
    visibleTemps,
    visiblePersonnes,
    cellMap,
  ]);

  const resetFilters = () => {
    setFVerbe(ALL);
    setFTemps(ALL);
    setFPersonne(ALL);
    setFGroupe(ALL);
    setFResultat(ALL);
  };

  const hasActiveFilter =
    fVerbe !== ALL ||
    fTemps !== ALL ||
    fPersonne !== ALL ||
    fGroupe !== ALL ||
    fResultat !== ALL;

  // Stats par dimension qui suivent les filtres actifs (sauf leur propre
  // dimension, et en ignorant le filtre Résultat qui fausserait le taux).
  const { tempsStats, personneStats, groupeStats } = useMemo(() => {
    const okVerbe = (c: Cell) => fVerbe === ALL || c.infinitif === fVerbe;
    const okGroupe = (c: Cell) => fGroupe === ALL || String(c.groupe) === fGroupe;
    const okTemps = (c: Cell) => fTemps === ALL || c.temps === fTemps;
    const okPersonne = (c: Cell) => fPersonne === ALL || c.personne === fPersonne;

    const aggregate = (
      members: { key: string; label: string }[],
      memberOf: (c: Cell) => string,
      filter: (c: Cell) => boolean
    ): Stat[] => {
      const acc = new Map<string, { total: number; success: number }>();
      for (const m of members) acc.set(m.key, { total: 0, success: 0 });
      for (const c of cells) {
        if (!filter(c)) continue;
        const k = memberOf(c);
        const entry = acc.get(k);
        if (!entry) continue;
        entry.total += c.total;
        entry.success += c.success;
      }
      return members.map((m) => {
        const { total, success } = acc.get(m.key)!;
        return {
          key: m.key,
          label: m.label,
          total,
          success,
          pct: total > 0 ? Math.round((success / total) * 100) : null,
        };
      });
    };

    const tempsStats = aggregate(
      TEMPS_ORDER.map((t) => ({ key: t, label: TEMPS_LABELS[t] })),
      (c) => c.temps,
      (c) => okVerbe(c) && okGroupe(c) && okPersonne(c)
    );
    const personneStats = aggregate(
      PERSON_ORDER.map((p) => ({ key: p, label: p })),
      (c) => c.personne,
      (c) => okVerbe(c) && okGroupe(c) && okTemps(c)
    );
    const groupeStats = aggregate(
      [1, 2, 3].map((g) => ({ key: String(g), label: `${g}${g === 1 ? "er" : "e"} groupe` })),
      (c) => String(c.groupe),
      (c) => okVerbe(c) && okTemps(c) && okPersonne(c)
    );

    return { tempsStats, personneStats, groupeStats };
  }, [cells, fVerbe, fTemps, fPersonne, fGroupe]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tableau de résultats</h1>
          <p className="text-muted-foreground mt-1">
            Vue d&apos;ensemble de tes conjugaisons par verbe, temps et personne.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/exercices/conjugaisons">
              <Dumbbell className="size-4" /> S&apos;entraîner
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/exercices/conjugaisons/historique">
              <History className="size-4" /> Mon historique
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartes de statistiques par dimension (suivent les filtres) */}
      {!loading && cells.length > 0 && (
        <div className="flex flex-col gap-4 mb-6">
          {/* Ligne 1 : Temps (4 col) + Groupes (3 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <div className="lg:col-span-4">
              <StatSection
                title="Temps"
                stats={tempsStats}
                gridClass="grid-cols-2 sm:grid-cols-4"
              />
            </div>
            <div className="lg:col-span-3">
              <StatSection title="Groupes" stats={groupeStats} gridClass="grid-cols-3" />
            </div>
          </div>
          {/* Ligne 2 : Personnes (6 col) */}
          <StatSection
            title="Personnes"
            stats={personneStats}
            gridClass="grid-cols-3 sm:grid-cols-6"
          />
        </div>
      )}

      {/* Filtres (identiques à la page historique) */}
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
            {TEMPS_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {TEMPS_LABELS[t]}
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
            {PERSON_ORDER.map((p) => (
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

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : visibleVerbes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {cells.length === 0
            ? "Aucune conjugaison disponible."
            : "Aucun verbe ne correspond à ces filtres."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="border-collapse text-sm w-full table-fixed">
              <colgroup>
                <col className="w-32" />
                {visibleTemps.map((t) =>
                  visiblePersonnes.map((p) => (
                    <col key={`${t}|${p}`} className="w-16" />
                  ))
                )}
              </colgroup>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 bg-muted/60 border px-3 py-2 text-left font-semibold"
                  >
                    Verbe
                  </th>
                  {visibleTemps.map((t) => (
                    <th
                      key={t}
                      colSpan={visiblePersonnes.length}
                      className="border-l-2 border bg-muted/60 px-2 py-2 text-center font-semibold whitespace-nowrap"
                    >
                      {TEMPS_LABELS[t]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {visibleTemps.map((t) =>
                    visiblePersonnes.map((p, pi) => (
                      <th
                        key={`${t}|${p}`}
                        className={`border px-2 py-1 text-center font-normal text-muted-foreground bg-muted/30 ${
                          pi === 0 ? "border-l-2" : ""
                        }`}
                      >
                        {p}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleVerbes.map((v) => (
                  <tr key={v}>
                    <td className="sticky left-0 z-10 bg-background border px-3 py-2 font-medium whitespace-nowrap">
                      {v}
                    </td>
                    {visibleTemps.map((t) =>
                      visiblePersonnes.map((p, pi) => {
                        const cell = cellMap.get(`${v}|${t}|${p}`);
                        const state = cellState(cell);
                        const display = matchesResultat(state) ? state : "none";
                        const cls =
                          display === "success"
                            ? "bg-green-100 text-green-800 font-semibold"
                            : display === "error"
                            ? "bg-red-100 text-red-800 font-semibold"
                            : "bg-white";
                        return (
                          <td
                            key={`${t}|${p}`}
                            className={`border px-2 py-2 text-center ${cls} ${
                              pi === 0 ? "border-l-2" : ""
                            }`}
                          >
                            {display === "none" ? "" : cell?.total}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[2px] bg-green-100 border border-green-300" />
              Au moins un succès (nombre d&apos;essais)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[2px] bg-red-100 border border-red-300" />
              Que des erreurs (nombre d&apos;essais)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[2px] bg-white border" />
              Jamais tentée
            </span>
          </div>
        </>
      )}
    </div>
  );
}
