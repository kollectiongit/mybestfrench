"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/currencies";
import { AlertCircle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const WEEKS = 10;

interface WeekCell {
  owed: number;
  paid: number | null;
}

interface PaymentProfile {
  id: string;
  first_name: string;
  currency: string | null;
  byWeek: Record<string, WeekCell>;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function localTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// Most recent Sunday on or before today.
function currentSunday(): Date {
  const t = localTodayUtc();
  return addDays(t, -t.getUTCDay());
}

function formatFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function WeeklyPaymentsTable() {
  const [endSunday, setEndSunday] = useState<Date>(currentSunday);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draftPaid, setDraftPaid] = useState<Record<string, string>>({});

  const currentSundayIso = useMemo(() => toIso(currentSunday()), []);
  const isAtCurrent = toIso(endSunday) >= currentSundayIso;

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        end_sunday: toIso(endSunday),
        weeks: String(WEEKS),
      });
      const res = await fetch(`/api/lecture/payments?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Erreur de chargement des versements");
        setWeeks([]);
        setProfiles([]);
        return;
      }
      const data = await res.json();
      setWeeks(data.weeks || []);
      setProfiles(data.profiles || []);
      setDraftPaid({});
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  }, [endSunday]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const paidKey = (profileId: string, iso: string) => `${profileId}|${iso}`;

  const getPaidValue = (profile: PaymentProfile, iso: string): string => {
    const key = paidKey(profile.id, iso);
    if (key in draftPaid) return draftPaid[key];
    const cell = profile.byWeek[iso];
    return cell && cell.paid != null ? String(cell.paid) : "";
  };

  const updatePaidLocal = (
    profileId: string,
    iso: string,
    paid: number | null
  ) => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const cell = p.byWeek[iso] || { owed: 0, paid: null };
        return {
          ...p,
          byWeek: { ...p.byWeek, [iso]: { ...cell, paid } },
        };
      })
    );
  };

  const clearDraft = (key: string) => {
    setDraftPaid((prev) => {
      const c = { ...prev };
      delete c[key];
      return c;
    });
  };

  const savePaid = async (profile: PaymentProfile, iso: string) => {
    const key = paidKey(profile.id, iso);
    if (!(key in draftPaid)) return; // nothing changed
    const raw = draftPaid[key];
    const cell = profile.byWeek[iso];
    const currentPaid = cell ? cell.paid : null;

    // Empty → clear the payment.
    if (raw.trim() === "") {
      if (currentPaid == null) {
        clearDraft(key);
        return;
      }
      const res = await fetch("/api/lecture/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profile.id,
          week_sunday: iso,
          amount_paid: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de l'enregistrement");
        clearDraft(key);
        return;
      }
      updatePaidLocal(profile.id, iso, null);
      clearDraft(key);
      return;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Montant invalide");
      clearDraft(key);
      return;
    }
    if (currentPaid != null && round2(currentPaid) === round2(amount)) {
      clearDraft(key);
      return;
    }

    const res = await fetch("/api/lecture/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profile.id,
        week_sunday: iso,
        amount_paid: round2(amount),
        currency: profile.currency,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de l'enregistrement");
      clearDraft(key);
      return;
    }
    updatePaidLocal(profile.id, iso, round2(amount));
    clearDraft(key);
    toast.success("Versement enregistré");
  };

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-gray-900">
        <h2 className="text-xl font-semibold text-white">
          Versements hebdomadaires
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEndSunday((s) => addDays(s, -7 * WEEKS))}
            aria-label="10 semaines précédentes"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={isAtCurrent}
            onClick={() =>
              setEndSunday((s) => {
                const next = addDays(s, 7 * WEEKS);
                const cur = currentSunday();
                return next > cur ? cur : next;
              })
            }
            aria-label="10 semaines suivantes"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucun profil à afficher.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th
                  rowSpan={2}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500 align-bottom w-28"
                >
                  Semaine
                  <span className="block text-[10px] font-normal normal-case text-gray-400">
                    (dimanche)
                  </span>
                </th>
                {profiles.map((p) => (
                  <th
                    key={p.id}
                    colSpan={2}
                    className="px-3 py-2 text-center text-sm font-semibold text-gray-900 border-l border-gray-200"
                  >
                    {p.first_name}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                {profiles.map((p) => (
                  <th
                    key={p.id}
                    colSpan={2}
                    className="p-0 border-l border-gray-200"
                  >
                    <div className="grid grid-cols-2">
                      <span className="px-3 py-1.5 text-[11px] font-medium uppercase text-gray-500">
                        À verser
                      </span>
                      <span className="px-3 py-1.5 text-[11px] font-medium uppercase text-gray-500 border-l border-gray-100">
                        Versé
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((iso) => {
                const isCurrent = iso === currentSundayIso;
                return (
                  <tr
                    key={iso}
                    className={`border-b last:border-b-0 ${
                      isCurrent ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {formatFr(iso)}
                    </td>
                    {profiles.map((p) => {
                      const cell = p.byWeek[iso] || { owed: 0, paid: null };
                      const owed = cell.owed;
                      const paidValue = getPaidValue(p, iso);
                      const paidNum =
                        cell.paid != null ? round2(cell.paid) : null;
                      const matched =
                        owed > 0 &&
                        paidNum != null &&
                        round2(owed) === paidNum;
                      const toPay = owed > 0 && !matched;
                      return (
                        <td
                          key={p.id}
                          colSpan={2}
                          className="p-0 border-l border-gray-200 align-top"
                        >
                          <div className="grid grid-cols-2 items-center">
                            <span className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                              {owed > 0
                                ? formatMoney(owed, p.currency)
                                : "—"}
                            </span>
                            <div
                              className={`px-3 py-2 border-l border-gray-100 flex items-center gap-1.5 ${
                                matched
                                  ? "bg-emerald-50"
                                  : toPay
                                    ? "bg-amber-50"
                                    : ""
                              }`}
                            >
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={paidValue}
                                onChange={(e) =>
                                  setDraftPaid((prev) => ({
                                    ...prev,
                                    [paidKey(p.id, iso)]: e.target.value,
                                  }))
                                }
                                onBlur={() => savePaid(p, iso)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    e.currentTarget.blur();
                                }}
                                className="h-9 w-24"
                              />
                              {matched ? (
                                <Check
                                  className="h-4 w-4 text-emerald-600 shrink-0"
                                  aria-label="Versement effectué"
                                />
                              ) : toPay ? (
                                <AlertCircle
                                  className="h-4 w-4 text-amber-600 shrink-0"
                                  aria-label="Versement à effectuer"
                                />
                              ) : null}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
