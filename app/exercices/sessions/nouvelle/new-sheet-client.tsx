"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ExerciseHint, SourceAnalysis } from "@/lib/training/schema";
import { Camera, ChevronLeft, FileText, Play, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  CategoryPicker,
  isTaxonomyChoiceValid,
  resolveTaxonomyChoice,
  TaxonomyChoice,
  useCategories,
} from "../components/categories";
import { Preparing, startSession } from "../components/preparing";
import type { Lesson, Skill } from "../types";

const MAX_PHOTOS = 4;
const MAX_SIDE = 1800;

/** Downscales a photo so uploads stay small (serverless body limit). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image illisible"))), "image/jpeg", 0.85)
  );
}

const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function lines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function LessonEditor({ lesson, onChange }: { lesson: Lesson; onChange: (l: Lesson) => void }) {
  const blocks: { key: keyof Lesson; title: string }[] = [
    { key: "je_retiens", title: "Je retiens" },
    { key: "je_sais_faire", title: "Je sais faire" },
  ];
  return (
    <div className="space-y-5">
      {blocks.map(({ key, title }) => (
        <div key={key} className="space-y-3">
          <h3 className="font-semibold">{title}</h3>
          {lesson[key].map((section, i) => {
            const update = (patch: Partial<typeof section>) =>
              onChange({
                ...lesson,
                [key]: lesson[key].map((s, j) => (j === i ? { ...s, ...patch } : s)),
              });
            return (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input value={section.heading} onChange={(e) => update({ heading: e.target.value })} className="font-semibold" />
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Supprimer la section"
                    onClick={() => onChange({ ...lesson, [key]: lesson[key].filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <textarea
                  className={textareaClass}
                  rows={Math.max(2, section.points.length + 1)}
                  defaultValue={section.points.join("\n")}
                  onBlur={(e) => update({ points: lines(e.target.value) })}
                  placeholder="Une règle par ligne (**gras** possible)"
                />
                <textarea
                  className={cn(textareaClass, "italic")}
                  rows={Math.max(1, section.examples.length)}
                  defaultValue={section.examples.join("\n")}
                  onBlur={(e) => update({ examples: lines(e.target.value) })}
                  placeholder="Exemples, un par ligne"
                />
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-sky-700"
            onClick={() => onChange({ ...lesson, [key]: [...lesson[key], { heading: "Nouvelle section", points: [], examples: [] }] })}
          >
            <Plus className="size-4" /> Section
          </Button>
        </div>
      ))}
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: Skill[]; onChange: (s: Skill[]) => void }) {
  return (
    <div className="space-y-2">
      {skills.map((skill, i) => (
        <div key={skill.id} className="flex gap-2">
          <Input
            value={skill.label}
            onChange={(e) => onChange(skills.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))}
          />
          <Button size="icon" variant="ghost" title="Retirer" disabled={skills.length <= 1} onClick={() => onChange(skills.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function NewSheetClient() {
  const router = useRouter();
  const { categories } = useCategories();
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "analyze" | "save" | "start">(null);

  // Review step
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [hints, setHints] = useState<ExerciseHint[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyChoice>({
    categoryId: null,
    newCategoryName: "",
    topicId: null,
    newTopicName: "",
  });

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    try {
      const resized = await Promise.all([...files].slice(0, room).map(resizeImage));
      setPhotos((p) => [...p, ...resized.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))]);
    } catch {
      toast.error("Impossible de lire cette image");
    }
  };

  const analyze = async () => {
    setBusy("analyze");
    try {
      const form = new FormData();
      if (mode === "photo") photos.forEach((p, i) => form.append("images", p.blob, `page-${i + 1}.jpg`));
      if (text.trim()) form.append("text", text.trim());
      const res = await fetch("/api/training/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      const a: SourceAnalysis = data.analysis;
      setAnalysis(a);
      setSourceImages(data.source_images);
      setTitle(a.title);
      setLesson(a.lesson);
      setSkills(a.skills);
      setHints(a.exercise_hints);
      setTaxonomy({
        categoryId: a.category.existing_id,
        newCategoryName: a.category.new_name ?? "",
        topicId: a.topic.existing_id,
        newTopicName: a.topic.new_name ?? "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const save = async (andStart: boolean) => {
    if (!lesson) return;
    setBusy(andStart ? "start" : "save");
    try {
      const topicId = await resolveTaxonomyChoice(taxonomy);
      const res = await fetch("/api/training/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          topic_id: topicId,
          source_type: sourceImages.length ? "photo" : "text",
          source_images: sourceImages,
          source_text: text.trim() || null,
          lesson,
          skills: skills.filter((s) => s.label.trim()),
          exercise_hints: hints,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      const sheetId: number = data.sheet.id;
      if (andStart) {
        const sessionId = await startSession(sheetId);
        router.push(`/exercices/sessions/${sessionId}`);
      } else {
        router.push(`/exercices/sessions/fiche/${sheetId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setBusy(null);
    }
  };

  if (busy === "analyze") {
    return (
      <Preparing
        message="L'IA lit la page et prépare la leçon…"
        hint="Elle repère les règles, les compétences à travailler et le type d'exercices. Cela prend environ 30 secondes."
      />
    );
  }
  if (busy === "start") {
    return <Preparing message="Le prof prépare les exercices…" hint="Encore une trentaine de secondes." />;
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link href="/exercices/sessions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Exercices
      </Link>
      <h1 className="text-3xl font-bold">Nouvelle fiche</h1>

      {!analysis ? (
        <div className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
          <div className="flex gap-2">
            {([
              ["photo", "Photo du cahier", Camera],
              ["text", "Thème et consignes", FileText],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold",
                  mode === value ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200"
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          {mode === "photo" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-[3/4] overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Page ${i + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-sky-300 hover:text-sky-700"
                  >
                    <Camera className="size-6" />
                    Ajouter une photo
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="text">{mode === "photo" ? "Consignes en plus (facultatif)" : "Thème et consignes"}</Label>
            <textarea
              id="text"
              className={textareaClass}
              rows={mode === "photo" ? 2 : 5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === "photo"
                  ? "Ex. : insiste sur les contractions au / aux / du / des"
                  : "Ex. : Les homophones a / à pour un CE2, avec des phrases à trous et des QCM"
              }
            />
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={analyze}
              disabled={mode === "photo" ? photos.length === 0 : !text.trim()}
            >
              <Sparkles className="size-4" /> Analyser
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la fiche</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <CategoryPicker categories={categories} value={taxonomy} onChange={setTaxonomy} />
          </div>

          <div className="space-y-3 rounded-2xl border bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Compétences travaillées</h2>
            <p className="text-sm text-muted-foreground">
              Les exercices et le bilan sont organisés autour de ces compétences.
            </p>
            <SkillsEditor skills={skills} onChange={setSkills} />
          </div>

          <div className="space-y-3 rounded-2xl border bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Leçon</h2>
            {lesson && <LessonEditor lesson={lesson} onChange={setLesson} />}
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="ghost" onClick={() => setAnalysis(null)} disabled={!!busy}>
              Recommencer
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => save(false)}
                disabled={!!busy || !title.trim() || !isTaxonomyChoiceValid(taxonomy)}
              >
                <Save className="size-4" /> Enregistrer
              </Button>
              <Button
                className="gap-2"
                onClick={() => save(true)}
                disabled={!!busy || !title.trim() || !isTaxonomyChoiceValid(taxonomy)}
              >
                <Play className="size-4" /> Enregistrer et commencer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
