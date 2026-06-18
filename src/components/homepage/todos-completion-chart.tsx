"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface ChartData {
  period: string;
  realized: number;
  applicable: number;
  percent: number;
}

const chartConfig = {
  percent: {
    label: "Réalisation",
    color: "#22c55e",
  },
} satisfies ChartConfig;

export function TodosCompletionChart() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [period, setPeriod] = useState("1m");
  const [dimension, setDimension] = useState("day");
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTickInterval = () => {
    if (dimension !== "day") return 0;
    switch (period) {
      case "1m":
        return 1;
      case "3m":
        return 3;
      case "6m":
        return 6;
      case "12m":
        return 9;
      default:
        return 0;
    }
  };
  const tickInterval = getTickInterval();

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
          period,
          dimension,
        });
        const res = await fetch(`/api/todos/stats?${params}`);
        if (!res.ok) throw new Error("Failed");
        setChartData(await res.json());
      } catch {
        setError("Erreur lors du chargement des données");
        setChartData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [profile?.id, period, dimension]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Aucun profil sélectionné</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center w-full">
        <h2 className="text-4xl font-bold">Réalisation des To-Do</h2>
        <div className="flex gap-4 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1w">1 semaine</SelectItem>
              <SelectItem value="1m">1 mois</SelectItem>
              <SelectItem value="3m">3 mois</SelectItem>
              <SelectItem value="6m">6 mois</SelectItem>
              <SelectItem value="12m">12 mois</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dimension} onValueChange={setDimension}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jour</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {isLoading ? (
        <div className="flex-1 min-h-0 flex items-end gap-2 px-4">
          {Array.from({ length: 20 }).map((_, i) => {
            const heights = [
              45, 65, 35, 55, 75, 40, 60, 50, 70, 30, 80, 45, 65, 35, 55, 75,
              40, 60, 50, 70,
            ];
            return (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{
                  height: `${heights[i % heights.length]}%`,
                  minHeight: "20px",
                }}
              />
            );
          })}
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ChartContainer config={chartConfig} className="h-full aspect-auto w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                top: 12,
                right: 12,
                left: 12,
                bottom: dimension === "day" ? 50 : 30,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                tickMargin={dimension === "day" ? 20 : 10}
                axisLine={false}
                interval={tickInterval}
                minTickGap={32}
                tick={
                  dimension === "day"
                    ? (props: {
                        x: number;
                        y: number;
                        payload: { value: string };
                      }) => {
                        const { x, y, payload } = props;
                        const parts = payload.value.split("|");
                        if (parts.length === 2) {
                          const [dayAbbrev, date] = parts;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={0}
                                y={0}
                                dy={0}
                                textAnchor="middle"
                                fontSize={12}
                                className="fill-muted-foreground"
                              >
                                {dayAbbrev}
                              </text>
                              <text
                                x={0}
                                y={0}
                                dy={16}
                                textAnchor="middle"
                                fontSize={12}
                                className="fill-muted-foreground"
                              >
                                {date}
                              </text>
                            </g>
                          );
                        }
                        return (
                          <text
                            x={x}
                            y={y}
                            dy={16}
                            textAnchor="middle"
                            fontSize={12}
                            className="fill-muted-foreground"
                          >
                            {payload.value}
                          </text>
                        );
                      }
                    : undefined
                }
                tickFormatter={
                  dimension !== "day"
                    ? (value) =>
                        value.length > 15 ? value.substring(0, 12) + "..." : value
                    : undefined
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, item, index, payload) => {
                      const d = payload as unknown as ChartData;
                      const formattedDate =
                        dimension === "day" && d.period
                          ? d.period.replace("|", " ")
                          : d.period;
                      return (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground">
                            {formattedDate}
                          </span>
                          <span className="font-bold">
                            {d.percent}% ({d.realized}/{d.applicable})
                          </span>
                        </span>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="percent" fill="#22c55e" radius={6} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
