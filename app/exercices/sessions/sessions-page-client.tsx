"use client";

import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { cn } from "@/lib/utils";
import { Camera, FileText, FolderCog, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CategoriesManagerDialog, useCategories } from "./components/categories";
import { formatScore, scoreClasses } from "./components/shared";
import type { SheetSummary } from "./types";

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

  const grouped = useMemo(() => {
    const visible = (sheets ?? []).filter((s) => categoryFilter == null || s.category.id === categoryFilter);
    const byCategory = new Map<string, SheetSummary[]>();
    visible.forEach((s) => byCategory.set(s.category.name, [...(byCategory.get(s.category.name) ?? []), s]));
    return [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sheets, categoryFilter]);

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
        grouped.map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700">{category}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((sheet) => (
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
                      <div className="text-xs text-muted-foreground">{sheet.topic.name}</div>
                      <div className="font-semibold leading-snug text-gray-900">{sheet.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {sheet.sessions_count === 0
                          ? "Jamais faite"
                          : `${sheet.sessions_count} session${sheet.sessions_count > 1 ? "s" : ""}`}
                      </div>
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
              ))}
            </div>
          </section>
        ))
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
