"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
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

// 5 conjugaisons "valent" la hauteur de 1 dictée
const CONJUGAISON_HEIGHT_FACTOR = 5;

interface ChartData {
  period: string;
  attempts: number;
  conjugaisons: number;
  // Exercices des sessions d'entraînement : 1 exercice = hauteur de 1 dictée
  exercices: number;
  // Expressions écrites : la barre a la hauteur de leur équivalent en dictées
  expressions: number;
  expressions_value: number;
  // Valeur tracée pour la barre conjugaison (mise à l'échelle)
  conjugaisonsScaled?: number;
}

const chartConfig = {
  attempts: {
    label: "Dictées",
    color: "var(--foreground)",
  },
  conjugaisonsScaled: {
    label: "Conjugaisons",
    color: "#2b7fff",
  },
  exercices: {
    label: "Exercices",
    color: "#f59e0b",
  },
  expressions_value: {
    label: "Expressions écrites",
    color: "#10b981",
  },
} satisfies ChartConfig;

type SegmentKey = keyof typeof chartConfig;

// Portions de la barre, de bas en haut
const SEGMENTS: {
  key: SegmentKey;
  label: string;
  color: string;
  count: (data: ChartData) => number;
}[] = (
  [
    ["attempts", (d: ChartData) => d.attempts],
    ["conjugaisonsScaled", (d: ChartData) => d.conjugaisons],
    ["exercices", (d: ChartData) => d.exercices],
    ["expressions_value", (d: ChartData) => d.expressions],
  ] as const
).map(([key, count]) => ({
  key,
  label: chartConfig[key].label,
  color: chartConfig[key].color,
  count,
}));

const BAR_RADIUS = 8;

function formatPoints(points: number) {
  const value = points.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${value} ${points < 2 ? "pt" : "pts"}`;
}

// Rectangle dont seuls les coins du haut et/ou du bas sont arrondis
function roundedBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  topRadius: number,
  bottomRadius: number
) {
  const right = x + width;
  const bottom = y + height;
  return [
    `M${x},${y + topRadius}`,
    `Q${x},${y} ${x + topRadius},${y}`,
    `H${right - topRadius}`,
    `Q${right},${y} ${right},${y + topRadius}`,
    `V${bottom - bottomRadius}`,
    `Q${right},${bottom} ${right - bottomRadius},${bottom}`,
    `H${x + bottomRadius}`,
    `Q${x},${bottom} ${x},${bottom - bottomRadius}`,
    "Z",
  ].join(" ");
}

function renderStackSegment(
  props: unknown,
  segmentIndex: number,
  hoveredIndex: number | null
) {
  const { x, y, width, height, payload, index } = props as {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: ChartData;
    index?: number;
  };

  if (
    x === undefined ||
    y === undefined ||
    !width ||
    height === undefined ||
    !payload ||
    index === undefined
  ) {
    return <g />;
  }

  const points = SEGMENTS.map((segment) => payload[segment.key] ?? 0);

  // Période sans activité : petit trait gris, tracé une seule fois
  if (points.every((value) => value === 0)) {
    if (segmentIndex !== 0) return <g />;
    return (
      <rect
        x={x}
        y={y + height - 5}
        width={width}
        height={5}
        fill="#e5e7eb"
        rx={4}
      />
    );
  }

  if (points[segmentIndex] === 0 || height <= 0) return <g />;

  // Seules les extrémités de la barre empilée sont arrondies
  const isBottom = points.slice(0, segmentIndex).every((value) => value === 0);
  const isTop = points.slice(segmentIndex + 1).every((value) => value === 0);
  const radius = Math.min(
    BAR_RADIUS,
    width / 2,
    isTop && isBottom ? height / 2 : height
  );

  return (
    <path
      d={roundedBarPath(
        x,
        y,
        width,
        height,
        isTop ? radius : 0,
        isBottom ? radius : 0
      )}
      fill={SEGMENTS[segmentIndex].color}
      opacity={hoveredIndex !== null && hoveredIndex !== index ? 0.5 : 1}
      style={{ transition: "opacity 0.2s ease-in-out" }}
    />
  );
}

function PointsTooltip({ data }: { data: ChartData }) {
  const total = SEGMENTS.reduce(
    (sum, segment) => sum + (data[segment.key] ?? 0),
    0
  );

  return (
    <div className="border-border/50 bg-background grid min-w-48 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex justify-between gap-4 font-medium">
        <span>{data.period.replace("|", " ")}</span>
        <span className="tabular-nums">{formatPoints(total)}</span>
      </div>
      {/* Même ordre que la barre : du haut vers le bas */}
      {[...SEGMENTS].reverse().map((segment) => (
        <div key={segment.key} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-[2px]"
            style={{ backgroundColor: segment.color }}
          />
          <span className="text-muted-foreground">
            {segment.label} ({segment.count(data)})
          </span>
          <span className="ml-auto pl-4 font-bold tabular-nums">
            {formatPoints(data[segment.key] ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

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

        const data: ChartData[] = await response.json();
        // Met à l'échelle les conjugaisons : 5 conjugaisons = hauteur de 1 dictée
        const scaled = data.map((d) => ({
          ...d,
          conjugaisons: d.conjugaisons ?? 0,
          exercices: d.exercices ?? 0,
          expressions: d.expressions ?? 0,
          expressions_value: d.expressions_value ?? 0,
          conjugaisonsScaled: (d.conjugaisons ?? 0) / CONJUGAISON_HEIGHT_FACTOR,
        }));
        setChartData(scaled);
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
                content={({ active, payload }) => {
                  const data = payload?.[0]?.payload as ChartData | undefined;
                  if (!active || !data) return null;
                  return <PointsTooltip data={data} />;
                }}
              />
              {SEGMENTS.map((segment, segmentIndex) => (
                <Bar
                  key={segment.key}
                  dataKey={segment.key}
                  stackId="points"
                  fill={segment.color}
                  shape={(props: unknown) =>
                    renderStackSegment(props, segmentIndex, hoveredIndex)
                  }
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
