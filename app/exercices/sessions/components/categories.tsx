"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { CategoryEntry } from "../types";

export function useCategories() {
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCategories(data.categories);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { categories, loading, reload };
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erreur");
  return data;
}

export async function createCategory(name: string): Promise<number> {
  return (await send("/api/categories", "POST", { name })).category.id;
}

export async function createTopic(categoryId: number, name: string): Promise<number> {
  return (await send("/api/topics", "POST", { category_id: categoryId, name })).topic.id;
}

// ---------------------------------------------------------------------------
// Picker: existing category/topic, or a new name for either
// ---------------------------------------------------------------------------

export interface TaxonomyChoice {
  categoryId: number | null;
  newCategoryName: string;
  topicId: number | null;
  newTopicName: string;
}

const NEW = "__new__";

/** Creates what is missing and returns the topic id. */
export async function resolveTaxonomyChoice(choice: TaxonomyChoice): Promise<number> {
  const categoryId = choice.categoryId ?? (await createCategory(choice.newCategoryName.trim()));
  return choice.topicId ?? createTopic(categoryId, choice.newTopicName.trim());
}

export function isTaxonomyChoiceValid(choice: TaxonomyChoice) {
  return (
    (choice.categoryId != null || !!choice.newCategoryName.trim()) &&
    (choice.topicId != null || !!choice.newTopicName.trim())
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryEntry[];
  value: TaxonomyChoice;
  onChange: (value: TaxonomyChoice) => void;
}) {
  const category = categories.find((c) => c.id === value.categoryId);
  const topics = category?.topics ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select
          value={value.categoryId != null ? String(value.categoryId) : NEW}
          onValueChange={(v) =>
            onChange({
              ...value,
              categoryId: v === NEW ? null : Number(v),
              topicId: null,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
            {categories.length > 0 && <SelectSeparator />}
            <SelectItem value={NEW}>+ Nouvelle catégorie</SelectItem>
          </SelectContent>
        </Select>
        {value.categoryId == null && (
          <Input
            placeholder="Nom de la catégorie (ex. Grammaire)"
            value={value.newCategoryName}
            onChange={(e) => onChange({ ...value, newCategoryName: e.target.value })}
          />
        )}
      </div>
      <div className="space-y-2">
        <Label>Thème</Label>
        <Select
          value={value.topicId != null ? String(value.topicId) : NEW}
          onValueChange={(v) => onChange({ ...value, topicId: v === NEW ? null : Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
            {topics.length > 0 && <SelectSeparator />}
            <SelectItem value={NEW}>+ Nouveau thème</SelectItem>
          </SelectContent>
        </Select>
        {value.topicId == null && (
          <Input
            placeholder="Nom du thème (ex. Le groupe nominal)"
            value={value.newTopicName}
            onChange={(e) => onChange({ ...value, newTopicName: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin dialog: rename / add / delete categories and topics
// ---------------------------------------------------------------------------

function InlineEdit({
  value,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const save = async () => {
    if (!text.trim()) return;
    await onSave(text.trim());
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={text}
        placeholder={placeholder}
        className="h-8"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button size="icon" variant="ghost" className="size-8" onClick={save}>
        <Check className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-8" onClick={onCancel}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function CategoriesManagerDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryEntry[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setEditing(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Catégories et thèmes</DialogTitle>
          <DialogDescription>
            Partagés entre les dictées et les fiches d&apos;exercices. Un thème utilisé ne peut pas être supprimé.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {categories.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                {editing === `c${c.id}` ? (
                  <InlineEdit
                    value={c.name}
                    onCancel={() => setEditing(null)}
                    onSave={(name) => run(() => send(`/api/categories/${c.id}`, "PATCH", { name }))}
                  />
                ) : (
                  <>
                    <span className="font-semibold">{c.name}</span>
                    <span className="flex">
                      <Button size="icon" variant="ghost" className="size-8" title="Renommer" onClick={() => setEditing(`c${c.id}`)}>
                        <Pencil className="size-4" />
                      </Button>
                      {c.topics.length === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-600"
                          title="Supprimer"
                          onClick={() => run(() => send(`/api/categories/${c.id}`, "DELETE"))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 space-y-1 pl-3">
                {c.topics.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    {editing === `t${t.id}` ? (
                      <InlineEdit
                        value={t.name}
                        onCancel={() => setEditing(null)}
                        onSave={(name) => run(() => send(`/api/topics/${t.id}`, "PATCH", { name }))}
                      />
                    ) : (
                      <>
                        <span>
                          {t.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {[
                              t.dictations_count && `${t.dictations_count} dictée${t.dictations_count > 1 ? "s" : ""}`,
                              t.sheets_count && `${t.sheets_count} fiche${t.sheets_count > 1 ? "s" : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="flex">
                          <Button size="icon" variant="ghost" className="size-7" title="Renommer" onClick={() => setEditing(`t${t.id}`)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {!t.in_use && t.sheets_count === 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-rose-600"
                              title="Supprimer"
                              onClick={() => run(() => send(`/api/topics/${t.id}`, "DELETE"))}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                ))}
                {editing === `new-topic-${c.id}` ? (
                  <InlineEdit
                    value=""
                    placeholder="Nouveau thème"
                    onCancel={() => setEditing(null)}
                    onSave={(name) => run(() => createTopic(c.id, name))}
                  />
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-sky-700" onClick={() => setEditing(`new-topic-${c.id}`)}>
                    <Plus className="size-3.5" /> Thème
                  </Button>
                )}
              </div>
            </div>
          ))}

          {editing === "new-category" ? (
            <InlineEdit
              value=""
              placeholder="Nouvelle catégorie"
              onCancel={() => setEditing(null)}
              onSave={(name) => run(() => createCategory(name))}
            />
          ) : (
            <Button variant="outline" className="w-full gap-2" onClick={() => setEditing("new-category")}>
              <Plus className="size-4" /> Nouvelle catégorie
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
