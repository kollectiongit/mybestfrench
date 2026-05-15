import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/lecture/stats?profile_id&period&dimension
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
    const period = searchParams.get("period") || "1m";
    const dimension = searchParams.get("dimension") || "day";

    const headerProfileId = request.headers.get("x-current-profile-id");
    const cookieProfileId = await getCurrentProfileFromCookie(request);
    const currentProfileId = profileId || headerProfileId || cookieProfileId;
    if (!currentProfileId) {
      return NextResponse.json(
        { error: "No profile selected" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: currentProfileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "1w":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1m":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const logs = await prisma.reading_logs.findMany({
      where: {
        profile_id: currentProfileId,
        read_date: { gte: startDate, lte: now },
      },
      select: { read_date: true, pages_read_count: true },
      orderBy: { read_date: "asc" },
    });

    const startYear = startDate.getFullYear();
    const endYear = now.getFullYear();
    const spansMultipleYears = startYear !== endYear;

    const formatPeriodKey = (date: Date): string => {
      switch (dimension) {
        case "day": {
          const dayAbbrevs = ["DI", "LU", "MA", "ME", "JE", "VE", "SA"];
          const dayAbbrev = dayAbbrevs[date.getDay()];
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          if (spansMultipleYears) {
            const year = date.getFullYear();
            return `${dayAbbrev}|${day}/${month}/${year}`;
          }
          return `${dayAbbrev}|${day}/${month}`;
        }
        case "week": {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const startDay = String(weekStart.getDate()).padStart(2, "0");
          const startMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
          const sYear = weekStart.getFullYear();
          const endDay = String(weekEnd.getDate()).padStart(2, "0");
          const endMonth = String(weekEnd.getMonth() + 1).padStart(2, "0");
          const eYear = weekEnd.getFullYear();
          if (sYear === eYear) {
            return `Semaine ${startDay}/${startMonth} - ${endDay}/${endMonth} ${sYear}`;
          }
          return `Semaine ${startDay}/${startMonth}/${sYear} - ${endDay}/${endMonth}/${eYear}`;
        }
        case "month": {
          const monthNames = [
            "Janvier",
            "Février",
            "Mars",
            "Avril",
            "Mai",
            "Juin",
            "Juillet",
            "Août",
            "Septembre",
            "Octobre",
            "Novembre",
            "Décembre",
          ];
          return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        }
        default:
          return date.toISOString().split("T")[0];
      }
    };

    const grouped = new Map<string, number>();
    logs.forEach((log) => {
      // read_date is stored as UTC midnight; reading it back in local time is fine for keying
      const date = new Date(log.read_date);
      const key = formatPeriodKey(date);
      grouped.set(key, (grouped.get(key) || 0) + (log.pages_read_count || 0));
    });

    const allPeriods: Array<{ period: string; pages: number; date: Date }> = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (dimension === "day") {
      const it = new Date(currentDate);
      while (it <= endDate) {
        const d = new Date(it);
        const key = formatPeriodKey(d);
        allPeriods.push({
          period: key,
          pages: grouped.get(key) || 0,
          date: d,
        });
        it.setDate(it.getDate() + 1);
      }
    } else if (dimension === "week") {
      const it = new Date(currentDate);
      it.setDate(it.getDate() - it.getDay());
      while (it <= endDate) {
        const d = new Date(it);
        const key = formatPeriodKey(d);
        allPeriods.push({
          period: key,
          pages: grouped.get(key) || 0,
          date: d,
        });
        it.setDate(it.getDate() + 7);
      }
    } else if (dimension === "month") {
      const it = new Date(currentDate);
      it.setDate(1);
      while (it <= endDate) {
        const d = new Date(it);
        const key = formatPeriodKey(d);
        allPeriods.push({
          period: key,
          pages: grouped.get(key) || 0,
          date: d,
        });
        it.setMonth(it.getMonth() + 1);
      }
    }

    const chartData = allPeriods
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ period, pages }) => ({ period, pages }));

    return NextResponse.json(chartData, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error fetching lecture stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
