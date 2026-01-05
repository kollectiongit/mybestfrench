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
  attempts: number;
}

const chartConfig = {
  attempts: {
    label: "Tentatives",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ExerciseAttemptsChart() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [period, setPeriod] = useState("1m"); // Default: 1 month
  const [dimension, setDimension] = useState("day"); // Default: day
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as true to show loading initially
  const [error, setError] = useState<string | null>(null);

  // Calculate tick interval for X-axis labels based on period
  const getTickInterval = () => {
    if (dimension !== "day") return 0;
    switch (period) {
      case "1m":
        return 1; // every 2 days (interval 1 means show tick 0, 2, 4, ...)
      case "3m":
        return 3; // every 4 days (interval 3 means show tick 0, 4, 8, ...)
      case "6m":
        return 6; // every 7 days (interval 6 means show tick 0, 7, 14, ...)
      case "12m":
        return 9; // every 10 days (interval 9 means show tick 0, 10, 20, ...)
      default:
        return 0; // show all ticks
    }
  };
  const tickInterval = getTickInterval();

  // State for hover effect
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

        const response = await fetch(`/api/exercices-attempts/stats?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const data = await response.json();
        setChartData(data);
      } catch (err) {
        console.error("Error fetching chart data:", err);
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
        <h2 className="text-4xl font-bold">
          Stats {profile?.first_name || ""}
        </h2>
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
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Chart skeleton with bars */}
          <div className="flex-1 flex items-end gap-2 px-4">
            {Array.from({ length: 20 }).map((_, i) => {
              // Use fixed pattern to avoid hydration mismatch
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
          {/* X-axis labels skeleton */}
          <div className="flex gap-2 px-4 pb-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-4" />
            ))}
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ChartContainer
            config={chartConfig}
            className="h-full aspect-auto w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                top: 12,
                right: 12,
                left: 12,
                bottom: dimension === "day" ? 50 : 30,
              }}
              onMouseMove={(state) => {
                if (state?.activeTooltipIndex !== undefined) {
                  const index =
                    typeof state.activeTooltipIndex === "number"
                      ? state.activeTooltipIndex
                      : parseInt(String(state.activeTooltipIndex), 10);
                  if (!isNaN(index)) {
                    setHoveredIndex(index);
                  }
                }
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                tickMargin={dimension === "day" ? 20 : 10}
                axisLine={false}
                interval={tickInterval}
                minTickGap={
                  dimension === "day"
                    ? period === "3m" || period === "6m" || period === "12m"
                      ? 40
                      : 32
                    : 32
                }
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
                                fill="currentColor"
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
                                fill="currentColor"
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
                            fill="currentColor"
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
                    ? (value) => {
                        // Truncate long labels for better display
                        if (value.length > 15) {
                          return value.substring(0, 12) + "...";
                        }
                        return value;
                      }
                    : undefined
                }
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    hideIndicator
                    formatter={(value, name, item, index, payload) => {
                      const chartData = payload as unknown as ChartData;
                      let formattedDate = chartData.period;

                      if (dimension === "day" && chartData.period) {
                        // Format: "LU|25/10" -> "LU 25/10"
                        formattedDate = chartData.period.replace("|", " ");
                      }

                      return (
                        <span>
                          <span className="text-muted-foreground">
                            {formattedDate}
                          </span>{" "}
                          <span className="font-bold">
                            {value} essai{value !== 1 ? "s" : ""}
                          </span>
                        </span>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="attempts"
                fill="var(--color-attempts)"
                radius={8}
                shape={(props: unknown) => {
                  const barProps = props as {
                    x?: number;
                    y?: number;
                    width?: number;
                    height?: number;
                    payload?: ChartData;
                    index?: number;
                    fill?: string;
                  };

                  if (
                    !barProps.payload ||
                    !barProps.x ||
                    !barProps.y ||
                    !barProps.width ||
                    barProps.height === undefined ||
                    barProps.index === undefined
                  ) {
                    // Default rendering for missing props
                    return <rect />;
                  }

                  const isZero = barProps.payload.attempts === 0;
                  const currentIndex = barProps.index;
                  const isHovered = hoveredIndex === currentIndex;
                  const isOtherHovered =
                    hoveredIndex !== null && hoveredIndex !== currentIndex;

                  // Determine fill color based on hover state
                  let fillColor: string;
                  if (isZero) {
                    fillColor = "#e5e7eb"; // Light gray for zero attempts
                  } else if (isHovered) {
                    fillColor = "#2b7fff"; // Original color when hovered
                  } else if (isOtherHovered) {
                    fillColor = "var(--color-attempts)"; // gray-500 when another bar is hovered
                  } else {
                    fillColor = "var(--color-attempts)"; // Original color
                  }

                  if (isZero) {
                    // For zero attempts: 5px height, light gray color
                    return (
                      <rect
                        x={barProps.x}
                        y={barProps.y + (barProps.height - 5)}
                        width={barProps.width}
                        height={5}
                        fill={fillColor}
                        rx={4}
                        style={{ transition: "fill 0.2s ease-in-out" }}
                      />
                    );
                  }

                  // For non-zero attempts: normal bar
                  return (
                    <rect
                      x={barProps.x}
                      y={barProps.y}
                      width={barProps.width}
                      height={barProps.height}
                      fill={fillColor}
                      rx={8}
                      style={{ transition: "fill 0.2s ease-in-out" }}
                    />
                  );
                }}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
