"use client";

import { Badge } from "@/components/ui/badge";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useEffect, useState } from "react";

interface DayData {
  day: string;
  date: string;
  realized: number;
  applicable: number;
  percent: number;
}

interface ApiResponse {
  days: DayData[];
  totalRealized: number;
  totalApplicable: number;
  totalPercent: number;
}

interface Props {
  week?: "current" | "previous";
  title?: string;
}

export function TodosWeekStats({ week = "current", title }: Props) {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ profile_id: profile.id, week });
        const res = await fetch(`/api/todos/last-7-days?${params}`);
        if (!res.ok) throw new Error("Failed");
        setData(await res.json());
      } catch {
        setError("Erreur lors du chargement des données");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [profile?.id, week]);

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }
  if (!profile) return null;
  if (error) return <div className="text-sm text-destructive py-4">{error}</div>;
  if (!data) return null;

  const badgeColor = (percent: number, applicable: number): string => {
    if (applicable === 0) return "bg-gray-300 text-gray-700 border-gray-300";
    if (percent >= 100) return "bg-green-500 text-white border-green-500";
    if (percent === 0) return "bg-red-500 text-white border-red-500";
    return "bg-yellow-500 text-white border-yellow-500";
  };

  return (
    <div className="py-2 md:py-4 px-3">
      {title && (
        <div className="text-sm md:text-lg text-left font-semibold inline-block whitespace-nowrap pb-2">
          {title}
        </div>
      )}
      <div className="space-y-2 text-left">
        {data.days.map((day, index) => (
          <div
            key={`${day.day}-${day.date}-${index}`}
            className="text-sm md:text-base flex items-center"
          >
            <span className="w-20 inline-block">
              {day.day} {day.date}
            </span>
            <Badge className={badgeColor(day.percent, day.applicable)}>
              {day.realized}/{day.applicable}
            </Badge>
          </div>
        ))}
        <div className="text-sm md:text-lg font-semibold pt-2">
          Total :{" "}
          <span className="font-bold">
            {data.totalRealized}/{data.totalApplicable}
          </span>{" "}
          <span className="text-muted-foreground">({data.totalPercent}%)</span>
        </div>
      </div>
    </div>
  );
}
