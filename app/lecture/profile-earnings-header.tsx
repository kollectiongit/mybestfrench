"use client";

import { formatMoney } from "@/lib/currencies";
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
    <div
      className="mb-8 grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
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
          <div className="text-lg font-semibold text-gray-900 mb-3">
            {p.first_name}
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <span className="text-gray-600">Gains cumulés</span>
            <span className="font-medium text-gray-900 tabular-nums">
              {formatMoney(p.total, p.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <span className="text-gray-600">Déjà versé</span>
            <span className="font-medium text-gray-900 tabular-nums">
              {formatMoney(p.paid, p.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-3">
            <span className="font-semibold text-gray-900">À verser</span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                p.to_pay > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {formatMoney(p.to_pay, p.currency)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
