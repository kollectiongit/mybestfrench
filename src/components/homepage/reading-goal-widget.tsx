"use client";

import { ReadingProgressRing } from "@/components/lecture/reading-progress-ring";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useEffect, useState } from "react";

interface GoalProgress {
  weekly_pages_goal: number | null;
  pages_read: number;
}

export function ReadingGoalWidget() {
  const { profile } = useCurrentProfile();
  const [data, setData] = useState<GoalProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/lecture/goal-progress?profile_id=${encodeURIComponent(profile.id)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setData({
              weekly_pages_goal: json.weekly_pages_goal ?? null,
              pages_read: json.pages_read ?? 0,
            });
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (!profile) return null;

  return (
    <div className="bg-white/60 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-4 shadow-lg flex items-center gap-4">
      <ReadingProgressRing
        pagesRead={data?.pages_read ?? 0}
        goal={data?.weekly_pages_goal}
        size={72}
        showCaption={false}
      />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-gray-900">
          Objectif lecture
        </span>
        {isLoading ? (
          <span className="text-xs text-gray-400">Chargement…</span>
        ) : data?.weekly_pages_goal ? (
          <>
            <span className="text-xs text-gray-600">
              {data.pages_read} / {data.weekly_pages_goal} pages cette semaine
            </span>
            <span className="text-[11px] text-gray-400">
              {profile.first_name}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-500">
            Définis un objectif depuis le profil
          </span>
        )}
      </div>
    </div>
  );
}
