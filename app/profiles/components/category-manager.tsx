"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconifyIcon } from "@/components/ui/iconify-icon";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TodoCategory {
  id: number;
  name: string;
  icon: string | null;
  todos_count: number;
}

export default function CategoryManager({
  profileId,
  categories,
  onChanged,
}: {
  profileId: string;
  categories: TodoCategory[];
  onChanged: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Le nom de la catégorie est obligatoire");
      return;
    }
    const res = await fetch("/api/todo-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId, name, icon: newIcon.trim() || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la création");
      return;
    }
    toast.success("Catégorie ajoutée");
    setNewName("");
    setNewIcon("");
    setIsAdding(false);
    onChanged();
  };

  const startEdit = (c: TodoCategory) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon ?? "");
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }
    const res = await fetch(`/api/todo-categories/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: editIcon.trim() || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur");
      return;
    }
    toast.success("Catégorie mise à jour");
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (c: TodoCategory) => {
    if (
      !window.confirm(
        `Supprimer la catégorie « ${c.name} » ?${
          c.todos_count > 0
            ? " Les To-Do liées seront simplement déclassées (sans catégorie)."
            : ""
        }`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/todo-categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la suppression");
      return;
    }
    toast.success("Catégorie supprimée");
    onChanged();
  };

  return (
    <div className="rounded-md border border-gray-200 p-3 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Catégories</Label>
        {!isAdding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nouvelle catégorie
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nom *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Sport"
                className="h-8"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Icône Iconify (optionnel)</Label>
              <Input
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                placeholder="mdi:run"
                className="h-8"
              />
            </div>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-8" onClick={handleAdd}>
              OK
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setIsAdding(false);
                setNewName("");
                setNewIcon("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-xs text-gray-500">Aucune catégorie.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) =>
            editingId === c.id ? (
              <li
                key={c.id}
                className="flex items-center gap-1 rounded-md border bg-white p-1"
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 w-28"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  placeholder="mdi:run"
                  className="h-7 w-24"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={saveEdit}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ) : (
              <li
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs"
              >
                {c.icon && <IconifyIcon name={c.icon} width={14} height={14} />}
                <span>{c.name}</span>
                <span className="text-gray-400">({c.todos_count})</span>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-gray-500 hover:text-gray-800"
                  aria-label="Modifier"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
