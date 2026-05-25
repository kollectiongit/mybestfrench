"use client";

import { ReadingProgressRing } from "@/components/lecture/reading-progress-ring";
import { Button } from "@/components/ui/button";
import ProfileEarningsHeader from "./profile-earnings-header";
import WeeklyPaymentsTable from "./weekly-payments-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoneyInteger } from "@/lib/currencies";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface BookSummary {
  id: number;
  title: string;
  start_page: number;
  remuneration_per_page: number | null;
  currency: string | null;
}

interface ActiveBook extends BookSummary {
  slot: 1 | 2;
}

interface LectureLog {
  id: number;
  page_number: number;
  pages_read_count: number;
}

interface LectureProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
  weekly_pages_goal: number | null;
  active_books: ActiveBook[];
  books: BookSummary[];
  logs: Record<string, Record<string, LectureLog>>;
}

interface DisplayBook {
  id: number;
  title: string;
  start_page: number;
  remuneration_per_page: number | null;
  currency: string | null;
  isActive: boolean;
  activeSlot?: 1 | 2;
}

const DAY_ABBREVS = ["LU", "MA", "ME", "JE", "VE", "SA", "DI"];

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - offset)
  );
}

function todayIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  )
    .toISOString()
    .slice(0, 10);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export default function LecturePageClient() {
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfCurrentWeek);
  const [profiles, setProfiles] = useState<LectureProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [earningsToken, setEarningsToken] = useState(0);
  // Books the user added manually as a column for the *current* week view.
  // Cleared when navigating to another week.
  const [extraBookIds, setExtraBookIds] = useState<
    Record<string, number[]>
  >({});
  const today = todayIso();

  useEffect(() => {
    setExtraBookIds({});
  }, [weekStart]);

  const weekDays = useMemo(() => {
    const days: { iso: string; label: string; short: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      days.push({
        iso: toIso(d),
        label: DAY_ABBREVS[i],
        short: shortDate(d),
        date: d,
      });
    }
    return days;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `Semaine du ${shortDate(weekStart)} au ${shortDate(end)}`;
  }, [weekStart]);

  const fetchWeek = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ week_start: toIso(weekStart) });
      const res = await fetch(`/api/lecture/week?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Erreur de chargement de la semaine");
        setProfiles([]);
        return;
      }
      const data = await res.json();
      setProfiles(data.profiles || []);
      setDraftValues({});
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  // For each profile, compute the books to display as columns for the current week.
  // Union of: currently active books, books with entries in this week, extras added by user.
  const profileDisplayBooks = useMemo(() => {
    const result: Record<string, DisplayBook[]> = {};
    for (const p of profiles) {
      const map = new Map<number, DisplayBook>();
      // 1. Active books — keep slot order
      const sortedActive = [...p.active_books].sort((a, b) => a.slot - b.slot);
      for (const ab of sortedActive) {
        map.set(ab.id, {
          id: ab.id,
          title: ab.title,
          start_page: ab.start_page,
          remuneration_per_page: ab.remuneration_per_page,
          currency: ab.currency,
          isActive: true,
          activeSlot: ab.slot,
        });
      }
      // 2. Books with entries in this week — order by earliest entry date for stable display
      const seenWithLog = new Map<number, string>(); // bookId -> earliest dateIso
      for (const dateIso of Object.keys(p.logs || {})) {
        for (const bookIdStr of Object.keys(p.logs[dateIso])) {
          const id = Number(bookIdStr);
          const current = seenWithLog.get(id);
          if (!current || dateIso < current) seenWithLog.set(id, dateIso);
        }
      }
      const historicalIds = [...seenWithLog.entries()]
        .filter(([id]) => !map.has(id))
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id]) => id);
      for (const id of historicalIds) {
        const meta = p.books.find((b) => b.id === id);
        if (meta) {
          map.set(id, {
            id: meta.id,
            title: meta.title,
            start_page: meta.start_page,
            remuneration_per_page: meta.remuneration_per_page,
            currency: meta.currency,
            isActive: false,
          });
        }
      }
      // 3. Extras added by user for this week
      const extras = extraBookIds[p.id] || [];
      for (const id of extras) {
        if (map.has(id)) continue;
        const meta = p.books.find((b) => b.id === id);
        if (meta) {
          map.set(id, {
            id: meta.id,
            title: meta.title,
            start_page: meta.start_page,
            remuneration_per_page: meta.remuneration_per_page,
            currency: meta.currency,
            isActive: false,
          });
        }
      }
      result[p.id] = [...map.values()];
    }
    return result;
  }, [profiles, extraBookIds]);

  const visibleProfiles = useMemo(
    () =>
      profiles.filter((p) => (profileDisplayBooks[p.id]?.length ?? 0) > 0),
    [profiles, profileDisplayBooks]
  );

  const cellKey = (profileId: string, bookId: number, iso: string) =>
    `${profileId}|${bookId}|${iso}`;

  const getCellValue = (
    profile: LectureProfile,
    book: DisplayBook,
    iso: string
  ): string => {
    const key = cellKey(profile.id, book.id, iso);
    if (key in draftValues) return draftValues[key];
    const log = profile.logs?.[iso]?.[String(book.id)];
    return log ? String(log.page_number) : "";
  };

  // Immutably update a single profile's logs without re-fetching the whole week
  // (avoids the scroll-to-top / focus-loss / reorder caused by fetchWeek()).
  const applyLogUpdate = (
    profileId: string,
    mutate: (
      logs: Record<string, Record<string, LectureLog>>
    ) => Record<string, Record<string, LectureLog>>
  ) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId ? { ...p, logs: mutate(p.logs || {}) } : p
      )
    );
  };

  const clearDraft = (key: string) => {
    setDraftValues((prev) => {
      const c = { ...prev };
      delete c[key];
      return c;
    });
  };

  const saveEntry = async (
    profile: LectureProfile,
    book: DisplayBook,
    iso: string
  ) => {
    const key = cellKey(profile.id, book.id, iso);
    const raw = key in draftValues ? draftValues[key] : "";
    const currentLog = profile.logs?.[iso]?.[String(book.id)];

    if (raw.trim() === "") {
      if (currentLog) {
        const params = new URLSearchParams({
          profile_id: profile.id,
          book_id: String(book.id),
          read_date: iso,
        });
        const res = await fetch(`/api/lecture/entry?${params}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Suppression impossible");
          clearDraft(key);
          return;
        }
        applyLogUpdate(profile.id, (logs) => {
          const next = { ...logs };
          if (next[iso]) {
            const day = { ...next[iso] };
            delete day[String(book.id)];
            if (Object.keys(day).length === 0) delete next[iso];
            else next[iso] = day;
          }
          return next;
        });
        clearDraft(key);
        toast.success("Entrée supprimée");
        setEarningsToken((t) => t + 1);
      } else {
        clearDraft(key);
      }
      return;
    }

    const pageNumber = Number(raw);
    if (!Number.isFinite(pageNumber) || pageNumber < 0) {
      toast.error("Numéro de page invalide");
      return;
    }

    if (currentLog && currentLog.page_number === Math.trunc(pageNumber)) {
      clearDraft(key);
      return;
    }

    const res = await fetch("/api/lecture/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profile.id,
        book_id: book.id,
        read_date: iso,
        page_number: Math.trunc(pageNumber),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Erreur lors de la sauvegarde");
      clearDraft(key);
      return;
    }

    const entry = data.entry as {
      id: number;
      book_id: number;
      read_date: string;
      page_number: number;
      pages_read_count: number;
    } | null;
    const nextAffected = data.next as {
      book_id: number;
      read_date: string;
      pages_read_count: number;
    } | null;

    if (entry) {
      applyLogUpdate(profile.id, (logs) => {
        const updated = { ...logs };
        const day = { ...(updated[entry.read_date] || {}) };
        day[String(entry.book_id)] = {
          id: entry.id,
          page_number: entry.page_number,
          pages_read_count: entry.pages_read_count,
        };
        updated[entry.read_date] = day;
        if (nextAffected) {
          const nextDay = { ...(updated[nextAffected.read_date] || {}) };
          const prevNext = nextDay[String(nextAffected.book_id)];
          if (prevNext) {
            nextDay[String(nextAffected.book_id)] = {
              ...prevNext,
              pages_read_count: nextAffected.pages_read_count,
            };
            updated[nextAffected.read_date] = nextDay;
          }
        }
        return updated;
      });
    }
    clearDraft(key);

    if (data.toast) {
      const fn = data.toast.level === "success" ? toast.success : toast;
      fn(data.toast.message);
    } else {
      toast.success("Enregistré");
    }
    setEarningsToken((t) => t + 1);
  };

  const addExtraBook = (profileId: string, bookId: number) => {
    setExtraBookIds((prev) => {
      const list = prev[profileId] || [];
      if (list.includes(bookId)) return prev;
      return { ...prev, [profileId]: [...list, bookId] };
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Lecture</h1>
        <p className="text-sm text-gray-600">
          Les colonnes affichent les livres lus dans la semaine et les livres
          actifs du profil. Pour suivre un nouveau livre, ajoute-le via
          &laquo;&nbsp;+&nbsp;Ajouter un livre&nbsp;&raquo; ou marque-le actif
          dans la fiche du profil.
        </p>
      </div>

      <ProfileEarningsHeader reloadToken={earningsToken} />

      <div className="flex items-center justify-center gap-4 mb-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-base font-medium min-w-[260px] text-center">
          {weekLabel}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Chargement…</div>
      ) : visibleProfiles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun profil à afficher pour cette semaine. Active un livre sur un
          profil ou ajoute un livre à la semaine.
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {visibleProfiles.map((profile) => (
            <ProfileLectureTable
              key={profile.id}
              profile={profile}
              displayBooks={profileDisplayBooks[profile.id] || []}
              weekDays={weekDays}
              today={today}
              getCellValue={getCellValue}
              setDraftValues={setDraftValues}
              saveEntry={saveEntry}
              cellKey={cellKey}
              onAddExtraBook={(bookId) => addExtraBook(profile.id, bookId)}
            />
          ))}
        </div>
      )}

      <div className="mt-12">
        <WeeklyPaymentsTable />
      </div>
    </div>
  );
}

interface ProfileLectureTableProps {
  profile: LectureProfile;
  displayBooks: DisplayBook[];
  weekDays: { iso: string; label: string; short: string; date: Date }[];
  today: string;
  getCellValue: (
    profile: LectureProfile,
    book: DisplayBook,
    iso: string
  ) => string;
  setDraftValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveEntry: (
    profile: LectureProfile,
    book: DisplayBook,
    iso: string
  ) => Promise<void>;
  cellKey: (profileId: string, bookId: number, iso: string) => string;
  onAddExtraBook: (bookId: number) => void;
}

function ProfileLectureTable({
  profile,
  displayBooks,
  weekDays,
  today,
  getCellValue,
  setDraftValues,
  saveEntry,
  cellKey,
  onAddExtraBook,
}: ProfileLectureTableProps) {
  const displayedIds = new Set(displayBooks.map((b) => b.id));
  const addableBooks = profile.books.filter((b) => !displayedIds.has(b.id));

  const dayTotals = weekDays.map((d) => {
    let sum = 0;
    for (const b of displayBooks) {
      const log = profile.logs?.[d.iso]?.[String(b.id)];
      if (log) sum += log.pages_read_count;
    }
    return sum;
  });
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const bookTotals: Record<string, number> = {};
  for (const b of displayBooks) {
    let sum = 0;
    for (const d of weekDays) {
      const log = profile.logs?.[d.iso]?.[String(b.id)];
      if (log) sum += log.pages_read_count;
    }
    bookTotals[String(b.id)] = sum;
  }

  const profileCurrency =
    displayBooks.find((b) => b.currency)?.currency ?? null;
  const hasRemuneration = displayBooks.some(
    (b) => b.remuneration_per_page != null
  );
  const dayGains = weekDays.map((d) => {
    let gain = 0;
    for (const b of displayBooks) {
      if (b.remuneration_per_page == null) continue;
      const log = profile.logs?.[d.iso]?.[String(b.id)];
      if (log) gain += log.pages_read_count * b.remuneration_per_page;
    }
    return Math.round(gain * 100) / 100;
  });
  const weekGain =
    Math.round(dayGains.reduce((a, b) => a + b, 0) * 100) / 100;

  return (
    <div
      id={`lecture-profile-${profile.id}`}
      className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-gray-50/50">
        <div className="flex items-center gap-4">
          {profile.avatar_url && (
            <Image
              src={`/api/avatars/${profile.avatar_url}`}
              alt={profile.first_name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
          )}
          <h2 className="text-xl font-semibold text-gray-900">
            {profile.first_name}
          </h2>
          {addableBooks.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => {
                const id = Number(v);
                if (Number.isFinite(id)) onAddExtraBook(id);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-auto gap-1">
                <Plus className="h-3.5 w-3.5" />
                <SelectValue placeholder="Ajouter un livre" />
              </SelectTrigger>
              <SelectContent>
                {addableBooks.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <ReadingProgressRing
          pagesRead={weekTotal}
          goal={profile.weekly_pages_goal}
          size={64}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500 w-14">
                Jour
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500 w-20">
                Date
              </th>
              {displayBooks.map((b) => (
                <th
                  key={b.id}
                  className="px-3 py-2 text-left text-xs font-normal min-w-[140px] border-l border-gray-100"
                >
                  <div
                    className={`flex items-center gap-1 ${
                      b.isActive ? "text-gray-700" : "text-gray-500"
                    }`}
                  >
                    {b.isActive && (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                        title="Livre actif"
                      />
                    )}
                    <span className="block truncate" title={b.title}>
                      {b.title}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500 min-w-[90px] border-l border-gray-200 bg-gray-50">
                Total
              </th>
              {hasRemuneration && (
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500 min-w-[90px] border-l border-gray-200 bg-gray-50">
                  Gains
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {weekDays.map((d, idx) => {
              const isToday = d.iso === today;
              const dailyTotal = dayTotals[idx];
              return (
                <tr
                  key={d.iso}
                  className={`border-b last:border-b-0 ${
                    isToday ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-sm font-semibold text-gray-700">
                    {d.label}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {d.short}
                  </td>
                  {displayBooks.map((b) => {
                    const log = profile.logs?.[d.iso]?.[String(b.id)];
                    const value = getCellValue(profile, b, d.iso);
                    return (
                      <td
                        key={b.id}
                        className="px-3 py-2 align-top border-l border-gray-100"
                      >
                        <div className="flex flex-col gap-0.5">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={value}
                            onChange={(e) =>
                              setDraftValues((prev) => ({
                                ...prev,
                                [cellKey(profile.id, b.id, d.iso)]:
                                  e.target.value,
                              }))
                            }
                            onBlur={() => saveEntry(profile, b, d.iso)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            className="h-9 w-20"
                          />
                          {log && (
                            <span className="text-[10px] text-gray-500 leading-tight">
                              +{log.pages_read_count} p
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-700 border-l border-gray-200 bg-gray-50/60">
                    {dailyTotal > 0 ? `${dailyTotal} p` : ""}
                  </td>
                  {hasRemuneration && (
                    <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-700 border-l border-gray-200 bg-gray-50/60">
                      {dayGains[idx] > 0
                        ? formatMoneyInteger(dayGains[idx], profileCurrency)
                        : ""}
                    </td>
                  )}
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td
                colSpan={2}
                className="px-3 py-2 text-sm font-semibold uppercase text-gray-700"
              >
                Total
              </td>
              {displayBooks.map((b) => (
                <td
                  key={b.id}
                  className="px-3 py-2 text-sm font-semibold text-gray-700 border-l border-gray-100"
                >
                  {bookTotals[String(b.id)] > 0
                    ? `${bookTotals[String(b.id)]} p`
                    : ""}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-base font-bold text-gray-900 border-l border-gray-200">
                {weekTotal > 0 ? `${weekTotal} p` : ""}
              </td>
              {hasRemuneration && (
                <td className="px-3 py-2 text-right text-base font-bold text-emerald-700 border-l border-gray-200">
                  {weekGain > 0
                    ? formatMoneyInteger(weekGain, profileCurrency)
                    : ""}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
