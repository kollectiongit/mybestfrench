"use client";

import { Badge } from "@/components/ui/badge";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useEffect, useState } from "react";

interface DayData {
  day: string;
  date: string;
  count: number;
}

interface ApiResponse {
  days: DayData[];
  total: number;
}

export function Last7DaysStats() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [total, setTotal] = useState(0);
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
        const params = new URLSearchParams({
          profile_id: profile.id,
        });

        const response = await fetch(
          `/api/exercices-attempts/last-7-days?${params}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const data: ApiResponse = await response.json();
        setDaysData(data.days);
        setTotal(data.total);
      } catch (err) {
        console.error("Error fetching last 7 days data:", err);
        setError("Erreur lors du chargement des données");
        setDaysData([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile?.id]);

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  if (error) {
    return <div className="text-sm text-destructive py-4">{error}</div>;
  }

  const getBadgeColorClass = (count: number): string => {
    if (count >= 5) return "bg-green-500 text-white border-green-500";
    if (count === 0) return "bg-red-500 text-white border-red-500";
    return "bg-yellow-500 text-white border-yellow-500";
  };

  return (
    <div className="py-12">
      <div className="space-y-1 text-left px-6">
        {daysData.map((day, index) => (
          <div key={`${day.day}-${day.date}-${index}`} className="text-base">
            <span className="w-20  inline-block">
              {day.day} {day.date}
            </span>
            <span className="font-bold">
              <Badge className={getBadgeColorClass(day.count)}>
                {day.count}
              </Badge>
            </span>
          </div>
        ))}
        <div className="text-base font-semibold pt-2">
          Total : <span className="font-bold">{total}</span>
        </div>
      </div>
    </div>
  );
}
