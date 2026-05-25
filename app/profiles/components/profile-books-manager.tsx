"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, formatMoney } from "@/lib/currencies";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const NO_CURRENCY = "__none__";

interface Book {
  id: number;
  title: string;
  start_page: number;
  remuneration_per_page: number | null;
  currency: string | null;
  created_at: string;
  logs_count: number;
}

interface ActiveBooksState {
  slot_1: number | null;
  slot_2: number | null;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

export default function ProfileBooksManager({
  profileId,
}: {
  profileId: string;
}) {
  const [books, setBooks] = useState<Book[]>([]);
  const [active, setActive] = useState<ActiveBooksState>({
    slot_1: null,
    slot_2: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartPage, setNewStartPage] = useState("0");
  const [newRemuneration, setNewRemuneration] = useState("");
  const [newCurrency, setNewCurrency] = useState<string>(NO_CURRENCY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRemuneration, setEditRemuneration] = useState("");
  const [editCurrency, setEditCurrency] = useState<string>(NO_CURRENCY);

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    try {
      const [booksRes, activeRes] = await Promise.all([
        fetch(
          `/api/lecture/books?profile_id=${encodeURIComponent(profileId)}`
        ),
        fetch(
          `/api/profiles/${encodeURIComponent(profileId)}/active-books`
        ),
      ]);
      if (booksRes.ok) {
        const data = await booksRes.json();
        setBooks(data.books || []);
      }
      if (activeRes.ok) {
        const data = await activeRes.json();
        setActive({
          slot_1: data.slot_1 ?? null,
          slot_2: data.slot_2 ?? null,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Le titre du livre est obligatoire");
      return;
    }
    const startPage = Number(newStartPage);
    if (!Number.isFinite(startPage) || startPage < 0) {
      toast.error("La page de départ doit être un nombre positif");
      return;
    }
    let remuneration: number | null = null;
    if (newRemuneration.trim() !== "") {
      const r = Number(newRemuneration);
      if (!Number.isFinite(r) || r < 0) {
        toast.error("La rémunération doit être un nombre positif");
        return;
      }
      remuneration = r;
    }
    const currency = newCurrency === NO_CURRENCY ? null : newCurrency;
    if (remuneration !== null && !currency) {
      toast.error("Sélectionne une devise pour la rémunération");
      return;
    }
    const res = await fetch("/api/lecture/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        title,
        start_page: Math.trunc(startPage),
        remuneration_per_page: remuneration,
        currency,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la création du livre");
      return;
    }
    toast.success("Livre ajouté");
    setNewTitle("");
    setNewStartPage("0");
    setNewRemuneration("");
    setNewCurrency(NO_CURRENCY);
    setIsAdding(false);
    await fetchData();
  };

  const startEdit = (book: Book) => {
    setEditingId(book.id);
    setEditTitle(book.title);
    setEditRemuneration(
      book.remuneration_per_page != null ? String(book.remuneration_per_page) : ""
    );
    setEditCurrency(book.currency ?? NO_CURRENCY);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditRemuneration("");
    setEditCurrency(NO_CURRENCY);
  };

  const handleDelete = async (book: Book) => {
    if (book.logs_count > 0) {
      toast.error(
        "Ce livre a déjà des pages enregistrées et ne peut pas être supprimé."
      );
      return;
    }
    if (
      !window.confirm(
        `Supprimer le livre « ${book.title} » ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/lecture/books/${book.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la suppression");
      return;
    }
    toast.success("Livre supprimé");
    await fetchData();
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const title = editTitle.trim();
    if (!title) {
      toast.error("Le titre ne peut pas être vide");
      return;
    }
    let remuneration: number | null = null;
    if (editRemuneration.trim() !== "") {
      const r = Number(editRemuneration);
      if (!Number.isFinite(r) || r < 0) {
        toast.error("La rémunération doit être un nombre positif");
        return;
      }
      remuneration = r;
    }
    const currency = editCurrency === NO_CURRENCY ? null : editCurrency;
    if (remuneration !== null && !currency) {
      toast.error("Sélectionne une devise pour la rémunération");
      return;
    }
    const res = await fetch(`/api/lecture/books/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        remuneration_per_page: remuneration,
        currency,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur");
      return;
    }
    toast.success("Livre mis à jour");
    cancelEdit();
    await fetchData();
  };

  const isActive = (bookId: number) =>
    active.slot_1 === bookId || active.slot_2 === bookId;

  const activeCount =
    (active.slot_1 !== null ? 1 : 0) + (active.slot_2 !== null ? 1 : 0);

  const toggleActive = async (bookId: number) => {
    const currently = isActive(bookId);
    let next: ActiveBooksState;

    if (currently) {
      // Deactivate — compact: if it's in slot_1, promote slot_2 into slot_1
      if (active.slot_1 === bookId) {
        next = { slot_1: active.slot_2, slot_2: null };
      } else {
        next = { slot_1: active.slot_1, slot_2: null };
      }
    } else {
      if (activeCount >= 2) {
        toast.error(
          "Maximum 2 livres actifs simultanés. Désactive d'abord un livre."
        );
        return;
      }
      next =
        active.slot_1 === null
          ? { slot_1: bookId, slot_2: active.slot_2 }
          : { slot_1: active.slot_1, slot_2: bookId };
    }

    const res = await fetch(
      `/api/profiles/${encodeURIComponent(profileId)}/active-books`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Impossible de modifier les livres actifs");
      return;
    }
    setActive(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Livres</Label>
        {!isAdding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter un livre
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-md border border-gray-200 p-3 space-y-2 bg-gray-50">
          <div className="space-y-1">
            <Label htmlFor="new-book-title" className="text-xs">
              Titre du livre *
            </Label>
            <Input
              id="new-book-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Harry Potter T1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-book-start-page" className="text-xs">
              Page de départ *
            </Label>
            <Input
              id="new-book-start-page"
              type="number"
              min={0}
              value={newStartPage}
              onChange={(e) => setNewStartPage(e.target.value)}
            />
            <p className="text-[10px] text-gray-500">
              Numéro de la page où l&apos;enfant commence le livre (souvent 0
              ou 1).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="new-book-remuneration" className="text-xs">
                Rémunération / page
              </Label>
              <Input
                id="new-book-remuneration"
                type="number"
                min={0}
                step="0.1"
                value={newRemuneration}
                onChange={(e) => setNewRemuneration(e.target.value)}
                placeholder="0.5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Devise</Label>
              <Select value={newCurrency} onValueChange={setNewCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Devise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CURRENCY}>Aucune</SelectItem>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewTitle("");
                setNewStartPage("0");
              }}
            >
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleAdd}>
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500">Chargement…</p>
      ) : books.length === 0 ? (
        <p className="text-xs text-gray-500">Aucun livre pour ce profil.</p>
      ) : (
        <ul className="divide-y border border-gray-200 rounded-md">
          {books.map((book) => {
            const active = isActive(book.id);
            return (
              <li
                key={book.id}
                className="px-3 py-2 flex items-center gap-2 text-sm"
              >
                {editingId === book.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8"
                      autoFocus
                      placeholder="Titre du livre"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={editRemuneration}
                        onChange={(e) => setEditRemuneration(e.target.value)}
                        placeholder="Rémunération / page"
                        className="h-8"
                      />
                      <Select
                        value={editCurrency}
                        onValueChange={setEditCurrency}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Devise" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CURRENCY}>Aucune</SelectItem>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} — {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveEdit}
                        className="h-8"
                      >
                        OK
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-8 w-8"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex flex-col">
                      <span className="font-medium">{book.title}</span>
                      <span className="text-[10px] text-gray-500">
                        Page de départ : {book.start_page}
                        {book.remuneration_per_page != null && book.currency
                          ? ` · ${formatMoney(book.remuneration_per_page, book.currency)}/page`
                          : ""}{" "}
                        · Ajouté le {formatDate(book.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className="h-7 px-3 text-xs"
                        onClick={() => toggleActive(book.id)}
                        title={
                          active
                            ? "Désactiver ce livre"
                            : "Marquer ce livre comme actif"
                        }
                      >
                        {active ? "Actif" : "Activer"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(book)}
                        className="h-7 w-7"
                        aria-label="Renommer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(book)}
                        disabled={book.logs_count > 0}
                        className="h-7 w-7 text-red-600 hover:text-red-700 disabled:text-gray-300"
                        aria-label="Supprimer"
                        title={
                          book.logs_count > 0
                            ? "Ce livre a déjà des pages enregistrées et ne peut pas être supprimé"
                            : "Supprimer ce livre"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
