"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconifyIcon } from "@/components/ui/iconify-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import CategoryManager, { TodoCategory } from "./category-manager";

const NO_CATEGORY = "__none__";

interface Todo {
  id: number;
  category_id: number | null;
  category: { id: number; name: string; icon: string | null } | null;
  name: string;
  unit: string;
  target_value: number;
  icon: string | null;
  start_date: string | null;
  end_date: string | null;
  archived: boolean;
  completions_count: number;
}

interface TodoFormState {
  name: string;
  unit: string;
  target_value: string;
  category_id: string;
  icon: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: TodoFormState = {
  name: "",
  unit: "",
  target_value: "",
  category_id: NO_CATEGORY,
  icon: "",
  start_date: "",
  end_date: "",
};

function formatTarget(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// Display row for a todo in the manager, draggable via its grip handle.
function SortableManagerRow({
  todo,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  todo: Todo;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`px-3 py-2 flex items-center gap-2 text-sm bg-white ${
        todo.archived ? "opacity-60" : ""
      } ${isDragging ? "shadow-md" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Réorganiser"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {todo.icon && (
        <IconifyIcon
          name={todo.icon}
          width={20}
          height={20}
          className="text-gray-600 shrink-0"
        />
      )}
      <div className="flex-1 flex flex-col">
        <span className="font-medium">
          {todo.name}
          {todo.archived && (
            <span className="ml-2 text-[10px] uppercase text-gray-400">
              archivée
            </span>
          )}
        </span>
        <span className="text-[10px] text-gray-500">
          Objectif : {formatTarget(todo.target_value)} {todo.unit}
          {todo.category ? ` · ${todo.category.name}` : ""}
          {todo.start_date ? ` · du ${todo.start_date}` : ""}
          {todo.end_date ? ` au ${todo.end_date}` : ""}
          {todo.completions_count > 0
            ? ` · ${todo.completions_count} réalisation(s)`
            : ""}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onEdit}
          className="h-7 w-7"
          aria-label="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onToggleArchive}
          className="h-7 w-7"
          aria-label={todo.archived ? "Réactiver" : "Archiver"}
          title={todo.archived ? "Réactiver" : "Archiver"}
        >
          {todo.archived ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={todo.completions_count > 0}
          className="h-7 w-7 text-red-600 hover:text-red-700 disabled:text-gray-300"
          aria-label="Supprimer"
          title={
            todo.completions_count > 0
              ? "Cette To-Do a des réalisations et ne peut pas être supprimée"
              : "Supprimer"
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

export default function TodoManager({ profileId }: { profileId: string }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<TodoFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TodoFormState>(EMPTY_FORM);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    try {
      const [todosRes, catsRes] = await Promise.all([
        fetch(
          `/api/todos?profile_id=${encodeURIComponent(profileId)}&include_archived=1`
        ),
        fetch(`/api/todo-categories?profile_id=${encodeURIComponent(profileId)}`),
      ]);
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.todos || []);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        setCategories(data.categories || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildPayload = (form: TodoFormState) => ({
    name: form.name.trim(),
    unit: form.unit.trim(),
    target_value: form.target_value,
    category_id: form.category_id === NO_CATEGORY ? null : Number(form.category_id),
    icon: form.icon.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
  });

  const validate = (form: TodoFormState): boolean => {
    if (!form.name.trim()) {
      toast.error("Le nom de la To-Do est obligatoire");
      return false;
    }
    if (!form.unit.trim()) {
      toast.error("L'unité est obligatoire (ex. pages, minutes)");
      return false;
    }
    const n = Number(form.target_value);
    if (!Number.isFinite(n) || n < 0 || form.target_value.trim() === "") {
      toast.error("L'objectif doit être un nombre positif");
      return false;
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      toast.error("La date de début doit précéder la date de fin");
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!validate(addForm)) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId, ...buildPayload(addForm) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la création");
      return;
    }
    toast.success("To-Do ajoutée");
    setAddForm(EMPTY_FORM);
    setIsAdding(false);
    fetchData();
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditForm({
      name: todo.name,
      unit: todo.unit,
      target_value: String(todo.target_value),
      category_id: todo.category_id ? String(todo.category_id) : NO_CATEGORY,
      icon: todo.icon ?? "",
      start_date: todo.start_date ?? "",
      end_date: todo.end_date ?? "",
    });
  };

  const saveEdit = async () => {
    if (editingId === null || !validate(editForm)) return;
    const res = await fetch(`/api/todos/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(editForm)),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur");
      return;
    }
    toast.success("To-Do mise à jour");
    setEditingId(null);
    fetchData();
  };

  const toggleArchive = async (todo: Todo) => {
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !todo.archived }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur");
      return;
    }
    toast.success(todo.archived ? "To-Do réactivée" : "To-Do archivée");
    fetchData();
  };

  const handleDelete = async (todo: Todo) => {
    if (todo.completions_count > 0) {
      toast.error(
        "Cette To-Do a déjà des réalisations et ne peut pas être supprimée. Archive-la à la place."
      );
      return;
    }
    if (
      !window.confirm(
        `Supprimer la To-Do « ${todo.name} » ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la suppression");
      return;
    }
    toast.success("To-Do supprimée");
    fetchData();
  };

  const visibleTodos = todos.filter((t) => showArchived || !t.archived);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newTodos = arrayMove(todos, oldIndex, newIndex);
    setTodos(newTodos);
    fetch("/api/todos/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        ids: newTodos.map((t) => t.id),
      }),
    }).catch(() => toast.error("Impossible d'enregistrer l'ordre"));
  };

  const renderForm = (
    form: TodoFormState,
    setForm: (f: TodoFormState) => void,
    onSubmit: () => void,
    onCancel: () => void,
    submitLabel: string
  ) => (
    <div className="rounded-md border border-gray-200 p-3 space-y-2 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nom *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Lire un livre"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Catégorie</Label>
          <Select
            value={form.category_id}
            onValueChange={(v) => setForm({ ...form, category_id: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Aucune</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unité *</Label>
          <Input
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="pages, minutes…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Objectif (chiffre) *</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.target_value}
            onChange={(e) => setForm({ ...form, target_value: e.target.value })}
            placeholder="10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Icône Iconify (optionnel)</Label>
          <div className="flex items-center gap-2">
            <Input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="mdi:book-open"
            />
            {form.icon.trim() && (
              <IconifyIcon name={form.icon} width={22} height={22} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date de début</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date de fin</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" size="sm" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <CategoryManager
        profileId={profileId}
        categories={categories}
        onChanged={fetchData}
      />

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">To-Do</Label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <Checkbox
              checked={showArchived}
              onCheckedChange={(c) => setShowArchived(c === true)}
            />
            Afficher les archivées
          </label>
          {!isAdding && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter une To-Do
            </Button>
          )}
        </div>
      </div>

      {isAdding &&
        renderForm(
          addForm,
          setAddForm,
          handleAdd,
          () => {
            setIsAdding(false);
            setAddForm(EMPTY_FORM);
          },
          "Ajouter"
        )}

      {isLoading ? (
        <p className="text-xs text-gray-500">Chargement…</p>
      ) : visibleTodos.length === 0 ? (
        <p className="text-xs text-gray-500">Aucune To-Do pour ce profil.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleTodos.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y border border-gray-200 rounded-md overflow-hidden">
              {visibleTodos.map((todo) =>
                editingId === todo.id ? (
                  <li key={todo.id} className="p-3 bg-white">
                    {renderForm(
                      editForm,
                      setEditForm,
                      saveEdit,
                      () => setEditingId(null),
                      "Enregistrer"
                    )}
                  </li>
                ) : (
                  <SortableManagerRow
                    key={todo.id}
                    todo={todo}
                    onEdit={() => startEdit(todo)}
                    onToggleArchive={() => toggleArchive(todo)}
                    onDelete={() => handleDelete(todo)}
                  />
                )
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
