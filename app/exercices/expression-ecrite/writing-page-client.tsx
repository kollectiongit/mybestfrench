"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { cn } from "@/lib/utils";
import { Loader2, MessagesSquare, PenLine, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDictees, score100Classes } from "./components/shared";
import type { ProjectSummary } from "./types";

export default function WritingPageClient() {
  const { profile } = useCurrentProfile();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [defaultMinWords, setDefaultMinWords] = useState(100);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [minWords, setMinWords] = useState("100");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    setProjects(null);
    fetch("/api/writing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setDefaultMinWords(d.default_min_words ?? 100);
      })
      .catch(() => setProjects([]));
  }, [profile?.id]);

  const openDialog = () => {
    setMinWords(String(defaultMinWords));
    setDialogOpen(true);
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_words: Number(minWords) || defaultMinWords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/exercices/expression-ecrite/${data.project.id}`);
    } catch {
      toast.error("Impossible de créer l'expression écrite");
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expression écrite</h1>
          <p className="mt-1 text-muted-foreground">
            Invente ton sujet avec le prof, écris ton texte, puis progresse à chaque essai.
          </p>
        </div>
        <Button onClick={openDialog} size="lg">
          <Plus className="size-4" /> Nouvelle expression écrite
        </Button>
      </div>

      {projects === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <PenLine className="mx-auto size-10 text-sky-500" />
          <p className="mt-3 font-medium">Pas encore d&apos;expression écrite</p>
          <p className="text-sm text-muted-foreground">
            Le prof te propose des idées à partir de tes livres, tes films et tes passions.
          </p>
          <Button className="mt-4" onClick={openDialog}>
            <Plus className="size-4" /> Commencer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const last = p.attempts.at(-1);
            const best = p.attempts.length ? Math.max(...p.attempts.map((a) => a.score)) : null;
            const value = p.attempts.reduce((sum, a) => sum + a.dictee_value, 0);
            return (
              <Link
                key={p.id}
                href={`/exercices/expression-ecrite/${p.id}`}
                className="group flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug text-gray-900 group-hover:text-sky-700">
                    {p.title ?? "Sujet à trouver"}
                  </h2>
                  {last && (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums", score100Classes(last.score))}>
                      {last.score}/100
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.status === "planning" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                      <MessagesSquare className="size-3" /> Trame en discussion
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                      <PenLine className="size-3" />
                      {p.draft_words > 0 ? `Brouillon : ${p.draft_words}/${p.min_words} mots` : `Objectif : ${p.min_words} mots`}
                    </span>
                  )}
                  {p.attempts.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                      <Trophy className="size-3" /> {p.attempts.length} essai{p.attempts.length > 1 ? "s" : ""} · meilleur {best}/100
                    </span>
                  )}
                  {value > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      Vaut {formatDictees(value)}
                    </span>
                  )}
                </div>
                <p className="mt-auto text-xs text-muted-foreground">
                  {last ? `Dernier essai le ${formatDate(last.created_at)}` : `Commencée le ${formatDate(p.created_at)}`}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle expression écrite</DialogTitle>
            <DialogDescription>
              Tu vas d&apos;abord trouver ton sujet et ta trame en discutant avec le prof, puis tu écriras ton texte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="min_words">Nombre de mots minimum</Label>
            <Input
              id="min_words"
              type="number"
              min={20}
              max={2000}
              step={10}
              value={minWords}
              onChange={(e) => setMinWords(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Objectif du profil : {defaultMinWords} mots. Il sera fixé pour cette expression écrite.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating && <Loader2 className="size-4 animate-spin" />} C&apos;est parti !
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
