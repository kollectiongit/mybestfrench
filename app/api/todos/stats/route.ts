import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest, toDateOnlyString } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function localKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/todos/stats?profile_id=...&period=1m&dimension=day
// Returns the completion percentage (realized / applicable) per period.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveProfileForRequest(
      request,
      searchParams.get("profile_id")
    );
    if ("error" in resolved) return resolved.error;

    const period = searchParams.get("period") || "1m";
    const dimension = searchParams.get("dimension") || "day";

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "1w":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "3m":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "6m":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "12m":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "1m":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    startDate.setHours(0, 0, 0, 0);

    const [todos, completions] = await Promise.all([
      prisma.todos.findMany({
        where: { profile_id: resolved.profileId, archived: false },
        select: { start_date: true, end_date: true, created_at: true },
      }),
      prisma.todo_completions.findMany({
        where: {
          profile_id: resolved.profileId,
          completion_date: { gte: startDate, lte: now },
        },
        select: { completion_date: true },
      }),
    ]);

    const todoKeys = todos.map((t) => ({
      start: t.start_date ? toDateOnlyString(t.start_date) : null,
      end: t.end_date ? toDateOnlyString(t.end_date) : null,
      created: toDateOnlyString(t.created_at),
    }));

    const realizedByDay = new Map<string, number>();
    completions.forEach((c) => {
      const key = toDateOnlyString(c.completion_date);
      realizedByDay.set(key, (realizedByDay.get(key) || 0) + 1);
    });

    const spansMultipleYears = startDate.getFullYear() !== now.getFullYear();
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ];

    const formatPeriodKey = (date: Date): string => {
      switch (dimension) {
        case "week": {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const sd = String(weekStart.getDate()).padStart(2, "0");
          const sm = String(weekStart.getMonth() + 1).padStart(2, "0");
          const sy = weekStart.getFullYear();
          const ed = String(weekEnd.getDate()).padStart(2, "0");
          const em = String(weekEnd.getMonth() + 1).padStart(2, "0");
          const ey = weekEnd.getFullYear();
          return sy === ey
            ? `Semaine ${sd}/${sm} - ${ed}/${em} ${sy}`
            : `Semaine ${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`;
        }
        case "month":
          return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        case "day":
        default: {
          const dayAbbrevs = ["DI", "LU", "MA", "ME", "JE", "VE", "SA"];
          const dayAbbrev = dayAbbrevs[date.getDay()];
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          return spansMultipleYears
            ? `${dayAbbrev}|${day}/${month}/${date.getFullYear()}`
            : `${dayAbbrev}|${day}/${month}`;
        }
      }
    };

    // Accumulate realized and applicable per period bucket, iterating day by day.
    const buckets = new Map<
      string, { realized: number; applicable: number; date: Date }
    >();

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const iter = new Date(startDate);
    while (iter <= endDate) {
      const date = new Date(iter);
      const dayKey = localKey(date);
      const applicable = todoKeys.filter(
        (t) =>
          t.created <= dayKey &&
          (t.start === null || t.start <= dayKey) &&
          (t.end === null || t.end >= dayKey)
      ).length;
      const realized = realizedByDay.get(dayKey) || 0;

      const periodKey = formatPeriodKey(date);
      const existing = buckets.get(periodKey);
      if (existing) {
        existing.realized += realized;
        existing.applicable += applicable;
      } else {
        // Anchor each bucket to its first day for chronological sorting.
        buckets.set(periodKey, { realized, applicable, date });
      }
      iter.setDate(iter.getDate() + 1);
    }

    const chartData = Array.from(buckets.entries())
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([period, v]) => ({
        period,
        realized: v.realized,
        applicable: v.applicable,
        percent:
          v.applicable > 0 ? Math.round((v.realized / v.applicable) * 100) : 0,
      }));

    return NextResponse.json(chartData, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error fetching todos stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
