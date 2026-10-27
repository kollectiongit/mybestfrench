"use client";

import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { cn } from "@/lib/utils";
import { Calendar, Camera, FileText, FolderCog, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CategoriesManagerDialog, useCategories } from "./components/categories";
import { formatScore, scoreClasses } from "./components/shared";
import type { SheetSummary } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "aujourd'hui à 18:42", "hier à 9:05", "il y a 3 jours", "le 12 oct.", "le 12 oct. 2025" */
function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  const time = date.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `aujourd'hui à ${time}`;
  if (days === 1) return `hier à ${time}`;
  if (days < 7) return `il y a ${days} jours`;
  return `le ${date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  })}`;
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
}

/** What the student did last with this sheet, and when. */
function lastActivity(sheet: SheetSummary) {
  if (sheet.last_completed_at) {
    return { label: `Faite ${formatWhen(sheet.last_completed_at)}`, title: fullDate(sheet.last_completed_at) };
  }
  if (sheet.in_progress_started_at) {
    return { label: `Commencée ${formatWhen(sheet.in_progress_started_at)}`, title: fullDate(sheet.in_progress_started_at) };
  }
  return { label: `Créée ${formatWhen(sheet.created_at)} · jamais faite`, title: fullDate(sheet.created_at) };
}

export default function SessionsPageClient() {
  const { profile } = useCurrentProfile();
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const { categories, reload } = useCategories();

  useEffect(() => {
    if (!profile?.id) return;
    setSheets(null);
    fetch("/api/training/sheets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSheets(d.sheets ?? []))
      .catch(() => setSheets([]));
  }, [profile?.id]);

  const usedCategories = useMemo(() => {
    const map = new Map<number, string>();
    sheets?.forEach((s) => map.set(s.category.id, s.category.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sheets]);

  // Already sorted by the API: most recent activity first
  const visible = (sheets ?? []).filter((s) => categoryFilter == null || s.category.id === categoryFilter);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exercices</h1>
          <p className="mt-1 text-muted-foreground">
            Des sessions d&apos;entraînement préparées par l&apos;IA, avec de nouvelles questions à chaque fois.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setManagerOpen(true)}>
            <FolderCog className="size-4" /> Catégories
          </Button>
          <Button asChild className="gap-2">
            <Link href="/exercices/sessions/nouvelle">
              <Plus className="size-4" /> Nouvelle fiche
            </Link>
          </Button>
        </div>
      </div>

      {usedCategories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[[null, "Toutes"] as const, ...usedCategories].map(([id, name]) => (
            <button
              key={id ?? "all"}
              type="button"
              onClick={() => setCategoryFilter(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                categoryFilter === id ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200 bg-white"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {sheets == null ? (
        <p className="py-12 text-center text-gray-500">Chargement…</p>
      ) : sheets.length === 0 ? (
        <div className="space-y-4 rounded-2xl border-2 border-dashed p-10 text-center">
          <p className="text-lg font-medium">Aucune fiche pour l&apos;instant</p>
          <p className="text-muted-foreground">
            Prends en photo une page de cahier d&apos;exercices, ou décris un thème : l&apos;IA prépare la leçon et les exercices.
          </p>
          <Button asChild className="gap-2">
            <Link href="/exercices/sessions/nouvelle">
              <Plus className="size-4" /> Créer ma première fiche
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((sheet) => {
            const activity = lastActivity(sheet);
            return (
              <div key={sheet.id} className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
                <Link href={`/exercices/sessions/fiche/${sheet.id}`} className="flex flex-1 gap-3 p-4 hover:bg-gray-50">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {sheet.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/images/${sheet.cover_image}`} alt="" className="size-full object-cover" />
                    ) : sheet.source_type === "photo" ? (
                      <Camera className="size-6 text-gray-400" />
                    ) : (
                      <FileText className="size-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {sheet.category.name} › {sheet.topic.name}
                    </div>
                    <div className="font-semibold leading-snug text-gray-900">{sheet.title}</div>
                    <div
                      title={activity.title}
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        sheet.last_completed_at ? "font-medium text-gray-700" : "text-muted-foreground"
                      )}
                    >
                      <Calendar className="size-3.5 shrink-0" />
                      {activity.label}
                    </div>
                    {sheet.sessions_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {sheet.sessions_count} session{sheet.sessions_count > 1 ? "s" : ""}
                        {sheet.best_score != null && sheet.sessions_count > 1 && ` · meilleure note ${formatScore(sheet.best_score)}/20`}
                      </div>
                    )}
                  </div>
                  {sheet.last_score != null && (
                    <span className={cn("h-fit rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums", scoreClasses(sheet.last_score))}>
                      {formatScore(sheet.last_score)}/20
                    </span>
                  )}
                </Link>
                {sheet.in_progress_session_id && (
                  <Link
                    href={`/exercices/sessions/${sheet.in_progress_session_id}`}
                    className="flex items-center justify-center gap-2 border-t bg-sky-50 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    <Play className="size-4" /> Reprendre la session en cours
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CategoriesManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        categories={categories}
        onChanged={reload}
      />
    </div>
  );
}
