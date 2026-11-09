"use client";

import { formatMoney, formatMoneyInteger } from "@/lib/currencies";
import { useCallback, useEffect, useState } from "react";

interface ProfileEarnings {
  id: string;
  first_name: string;
  currency: string | null;
  total: number;
  current_week: number;
  paid: number;
  to_pay: number;
}

// Sums an amount across profiles, one line per currency.
function formatTotals(
  profiles: ProfileEarnings[],
  amountOf: (profile: ProfileEarnings) => number
): string {
  const byCurrency = new Map<string | null, number>();
  for (const p of profiles) {
    byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + amountOf(p));
  }
  return [...byCurrency]
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" + ");
}

function currentMondayIso(): string {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - offset)
  )
    .toISOString()
    .slice(0, 10);
}

export default function ProfileEarningsHeader({
  reloadToken,
}: {
  reloadToken: number;
}) {
  const [profiles, setProfiles] = useState<ProfileEarnings[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    try {
      const params = new URLSearchParams({ week_start: currentMondayIso() });
      const res = await fetch(`/api/lecture/earnings?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setProfiles([]);
        return;
      }
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings, reloadToken]);

  // Only show cards for profiles that actually earn money (a remuneration set).
  const earners = profiles.filter((p) => p.total > 0 || p.current_week > 0);

  if (isLoading || earners.length === 0) return null;

  return (
    <div className="mb-8 grid gap-4">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${earners.length}, minmax(0, 1fr))`,
        }}
      >
        {earners.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              document
                .getElementById(`lecture-profile-${p.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="text-left rounded-2xl border border-gray-100 bg-white shadow p-5 transition hover:shadow-md hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
          >
            <div className="text-sm font-semibold text-gray-900 mb-3">
              {p.first_name}
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Gains cumulés
                </div>
                <div className="text-3xl font-bold text-emerald-700 leading-tight">
                  {formatMoneyInteger(p.total, p.currency)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Cette semaine
                </div>
                <div className="text-xl font-semibold text-gray-800 leading-tight">
                  {formatMoneyInteger(p.current_week, p.currency)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-gray-100 pt-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Déjà versé
                </div>
                <div className="text-xl font-semibold text-gray-800 leading-tight">
                  {formatMoney(p.paid, p.currency)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  À verser
                </div>
                <div className="text-xl font-semibold text-amber-700 leading-tight">
                  {formatMoney(p.to_pay, p.currency)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {earners.length > 1 && (
        <div className="flex items-end justify-between gap-4 rounded-2xl border border-gray-100 bg-white shadow p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total versé
            </div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {formatTotals(earners, (p) => p.paid)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total à verser
            </div>
            <div className="text-2xl font-bold text-amber-700 leading-tight">
              {formatTotals(earners, (p) => p.to_pay)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
