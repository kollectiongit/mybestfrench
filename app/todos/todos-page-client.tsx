"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { IconifyIcon } from "@/components/ui/iconify-icon";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrentProfile } from "@/hooks/use-current-profile";
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
  Angry,
  Clock,
  GripVertical,
  Hourglass,
  Meh,
  PartyPopper,
  Smile,
  Timer,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import TodoChrono from "./todo-chrono";

interface Completion {
  id: number;
  completed_at: string;
  actual_value: number | null;
  satisfaction: number | null;
  duration_seconds: number | null;
}

interface TodoItem {
  id: number;
  name: string;
  unit: string;
  target_value: number;
  icon: string | null;
  position: number;
  category: { id: number; name: string; icon: string | null } | null;
  completion: Completion | null;
}

const SATISFACTIONS = [
  {
    value: 1,
    Icon: Angry,
    label: "Tâche difficile ou pénible à réaliser",
    color: "text-red-500",
  },
  {
    value: 2,
    Icon: Meh,
    label: "Tâche réalisée normalement",
    color: "text-amber-500",
  },
  {
    value: 3,
    Icon: Smile,
    label: "Tâche réalisée avec plaisir et envie",
    color: "text-green-500",
  },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type UpdatePayload = {
  actual_value?: number | null;
  satisfaction?: number | null;
  duration_seconds?: number | null;
};

// ---------------------------------------------------------------------------
// Presentational card for a single todo (shared by pending + done lists).
// ---------------------------------------------------------------------------
function TodoCard({
  todo,
  onToggle,
  onUpdate,
  onStartChrono,
  dragHandle,
}: {
  todo: TodoItem;
  onToggle: () => void;
  onUpdate: (payload: UpdatePayload) => void;
  onStartChrono: () => void;
  dragHandle?: React.ReactNode;
}) {
  const done = !!todo.completion;
  const [actual, setActual] = useState("");
  const [durH, setDurH] = useState("");
  const [durM, setDurM] = useState("");

  // Sync local drafts whenever the completion data changes (e.g. chrono validate).
  useEffect(() => {
    setActual(
      todo.completion?.actual_value != null
        ? String(todo.completion.actual_value)
        : ""
    );
    const secs = todo.completion?.duration_seconds ?? null;
    if (secs != null) {
      setDurH(String(Math.floor(secs / 3600)));
      setDurM(String(Math.floor((secs % 3600) / 60)));
    } else {
      setDurH("");
      setDurM("");
    }
  }, [
    todo.completion?.id,
    todo.completion?.actual_value,
    todo.completion?.duration_seconds,
  ]);

  const commitActual = () => {
    const current = todo.completion?.actual_value ?? null;
    const next = actual.trim() === "" ? null : Number(actual);
    if (next !== current) onUpdate({ actual_value: next });
  };

  const commitDuration = () => {
    const h = durH.trim() === "" ? 0 : Number(durH);
    const m = durM.trim() === "" ? 0 : Number(durM);
    const next =
      durH.trim() === "" && durM.trim() === "" ? null : h * 3600 + m * 60;
    const current = todo.completion?.duration_seconds ?? null;
    if (next !== current) onUpdate({ duration_seconds: next });
  };

  const leadingIcon = todo.icon || todo.category?.icon || null;

  const satisfactionButtons = (
    <div className="flex items-center gap-1 shrink-0">
      {SATISFACTIONS.map((s) => {
        const selected = todo.completion?.satisfaction === s.value;
        const SIcon = s.Icon;
        return (
          <Tooltip key={s.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() =>
                  onUpdate({ satisfaction: selected ? null : s.value })
                }
                className={`rounded-full p-1 transition-colors ${
                  selected
                    ? `${s.color} bg-gray-100`
                    : "text-gray-300 hover:text-gray-500"
                }`}
                aria-label={s.label}
              >
                <SIcon className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{s.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );

  return (
    <Card className={done ? "bg-gray-50 py-3" : "py-3"}>
      <CardContent className="px-3 md:px-4">
        <div className="flex items-start gap-2 md:gap-3">
          {/* Drag handle + checkbox, vertically aligned together */}
          <div className="flex items-center gap-1 pt-0.5">
            {dragHandle}
            <Checkbox
              checked={done}
              onCheckedChange={onToggle}
              className="size-5"
              aria-label={done ? "Décocher la tâche" : "Cocher la tâche"}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Line 1: icon + title + category chip + time chip / satisfaction */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {leadingIcon && (
                  <IconifyIcon
                    name={leadingIcon}
                    width={18}
                    height={18}
                    className="text-gray-600 shrink-0"
                  />
                )}
                <span
                  className={`font-medium transition-all ${
                    done ? "line-through text-gray-400" : "text-gray-900"
                  }`}
                >
                  {todo.name}
                </span>
                {todo.category && (
                  <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600">
                    {todo.category.name}
                  </span>
                )}
                {done && todo.completion && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {formatTime(todo.completion.completed_at)}
                  </span>
                )}
              </div>
              {done && todo.completion && satisfactionButtons}
            </div>

            {/* Line 2: objective */}
            <div
              className={`text-xs mt-1 ${
                done ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              Objectif : {formatNumber(todo.target_value)} {todo.unit}
            </div>

            {/* Pending: chrono launcher */}
            {!done && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onStartChrono}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Timer className="h-3.5 w-3.5" />
                  Démarrer un chrono
                </button>
              </div>
            )}

            {/* Line 3: réalisé | temps (clear separation) */}
            {done && todo.completion && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Réalisé :</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    onBlur={commitActual}
                    className="h-7 w-20"
                  />
                  <span>{todo.unit}</span>
                </div>

                <span className="h-5 w-px bg-gray-300" aria-hidden="true" />

                <div className="flex items-center gap-1">
                  <Hourglass className="h-3.5 w-3.5" />
                  <span>Temps :</span>
                  <Input
                    type="number"
                    min={0}
                    value={durH}
                    onChange={(e) => setDurH(e.target.value)}
                    onBlur={commitDuration}
                    className="h-7 w-14"
                    aria-label="Heures"
                  />
                  <span>h</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={durM}
                    onChange={(e) => setDurM(e.target.value)}
                    onBlur={commitDuration}
                    className="h-7 w-14"
                    aria-label="Minutes"
                  />
                  <span>min</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sortable wrapper for a pending todo (provides the drag handle).
function SortableTodoRow({
  todo,
  onToggle,
  onUpdate,
  onStartChrono,
}: {
  todo: TodoItem;
  onToggle: () => void;
  onUpdate: (payload: UpdatePayload) => void;
  onStartChrono: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : ""}>
      <TodoCard
        todo={todo}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onStartChrono={onStartChrono}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
            aria-label="Réorganiser"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        }
      />
    </li>
  );
}

export default function TodosPageClient() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ url: string } | null>(null);
  const [chronoTodo, setChronoTodo] = useState<TodoItem | null>(null);

  const today = todayString();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const dateLabel = useMemo(() => {
    const label = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const fetchData = useCallback(async () => {
    if (!profile?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/todos/today?profile_id=${encodeURIComponent(
          profile.id
        )}&date=${today}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setItems(data.todos || []);
    } catch {
      setError("Erreur lors du chargement des To-Do");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const patchItem = (id: number, completion: Completion | null) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, completion } : it))
    );
  };

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  // Close the celebration overlay on Escape.
  useEffect(() => {
    if (!celebration) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissCelebration();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [celebration, dismissCelebration]);

  const celebrate = useCallback(async () => {
    try {
      const res = await fetch("/api/giphy/random");
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.url) return;
      setCelebration({ url: data.url });
    } catch {
      // best-effort
    }
  }, []);

  const checkTodo = async (todo: TodoItem, durationSeconds?: number) => {
    const res = await fetch(`/api/todos/${todo.id}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: today,
        ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}),
      }),
    });
    if (!res.ok) {
      toast.error("Impossible de cocher la tâche");
      return;
    }
    const data = await res.json();
    patchItem(todo.id, data.completion);
    celebrate();
  };

  const toggle = async (todo: TodoItem) => {
    if (todo.completion) {
      const res = await fetch(`/api/todos/${todo.id}/completion?date=${today}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Impossible de décocher la tâche");
        return;
      }
      patchItem(todo.id, null);
    } else {
      await checkTodo(todo);
    }
  };

  const updateCompletion = async (todo: TodoItem, payload: UpdatePayload) => {
    if (!todo.completion) return;
    const res = await fetch(`/api/todos/${todo.id}/completion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, ...payload }),
    });
    if (!res.ok) {
      toast.error("Impossible de mettre à jour la tâche");
      return;
    }
    const data = await res.json();
    patchItem(todo.id, data.completion);
  };

  const validateChrono = async (seconds: number) => {
    if (!chronoTodo) return;
    await checkTodo(chronoTodo, seconds);
    setChronoTodo(null);
  };

  const pending = useMemo(() => items.filter((i) => !i.completion), [items]);
  const doneItems = useMemo(
    () =>
      items
        .filter((i) => i.completion)
        .sort(
          (a, b) =>
            new Date(a.completion!.completed_at).getTime() -
            new Date(b.completion!.completed_at).getTime()
        ),
    [items]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pending.findIndex((i) => i.id === active.id);
    const newIndex = pending.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newPending = arrayMove(pending, oldIndex, newIndex);
    const done = items.filter((i) => i.completion);
    const newItems = [...newPending, ...done];
    setItems(newItems);
    if (profile?.id) {
      fetch("/api/todos/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profile.id,
          ids: newItems.map((i) => i.id),
        }),
      }).catch(() => toast.error("Impossible d'enregistrer l'ordre"));
    }
  };

  const total = items.length;
  const doneCount = doneItems.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  return (
    <div className="container mx-auto px-4 py-24 md:py-28 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 capitalize">
          {dateLabel}
        </h1>

        {!profileLoading && profile && total > 0 && (
          <div className="mt-4 rounded-2xl border bg-white/70 p-5 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-extrabold text-green-600 tabular-nums">
                    {doneCount}
                  </span>
                  <span className="text-2xl md:text-3xl font-semibold text-gray-400 tabular-nums">
                    / {total}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  tâche{total > 1 ? "s" : ""} réalisée{doneCount > 1 ? "s" : ""}{" "}
                  aujourd&apos;hui
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-3xl md:text-4xl font-bold tabular-nums ${
                    allDone ? "text-green-600" : "text-gray-700"
                  }`}
                >
                  {percent}%
                </span>
                {allDone && (
                  <p className="text-sm font-medium text-green-600">
                    Objectif atteint 🎉
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className={`h-full rounded-full ${
                  allDone
                    ? "bg-green-500"
                    : "bg-gradient-to-r from-green-400 to-green-600"
                }`}
                initial={false}
                animate={{ width: `${percent}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
          </div>
        )}
      </header>

      {profileLoading || isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : !profile ? (
        <p className="text-muted-foreground">
          Sélectionne un profil pour voir tes To-Do.
        </p>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : total === 0 ? (
        <p className="text-muted-foreground">
          Aucune To-Do pour aujourd&apos;hui. Ajoute-en depuis l&apos;édition de
          profil.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Pending todos — drag & drop sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pending.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {pending.map((todo) => (
                  <SortableTodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={() => toggle(todo)}
                    onUpdate={(payload) => updateCompletion(todo, payload)}
                    onStartChrono={() => setChronoTodo(todo)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {/* Completed todos — sorted chronologically, not draggable */}
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {doneItems.map((todo) => (
                <motion.li
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                >
                  <TodoCard
                    todo={todo}
                    onToggle={() => toggle(todo)}
                    onUpdate={(payload) => updateCompletion(todo, payload)}
                    onStartChrono={() => setChronoTodo(todo)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Fullscreen chronometer */}
      <AnimatePresence>
        {chronoTodo && (
          <TodoChrono
            todoName={chronoTodo.name}
            onValidate={validateChrono}
            onClose={() => setChronoTodo(null)}
          />
        )}
      </AnimatePresence>

      {/* Celebration GIF overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissCelebration}
          >
            <button
              type="button"
              onClick={dismissCelebration}
              className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-900 shadow-lg hover:bg-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
              Fermer
            </button>
            <motion.div
              className="flex items-center justify-center gap-2 pb-4 text-3xl font-bold text-white drop-shadow"
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <PartyPopper className="h-8 w-8 text-green-400" />
              Bravo !
            </motion.div>
            <motion.img
              key={celebration.url}
              src={celebration.url}
              alt="Célébration"
              className="max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
