import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/exercices-attempts/stats - Get exercise attempts statistics
export async function GET(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
    const period = searchParams.get("period") || "1m"; // default: 1 month
    const dimension = searchParams.get("dimension") || "day"; // default: day

    // Resolve current profile: prefer query param, then header, then cookie
    const headerProfileId = request.headers.get('x-current-profile-id');
    const cookieProfileId = await getCurrentProfileFromCookie(request);
    const currentProfileId = profileId || headerProfileId || cookieProfileId;

    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    // Verify the profile belongs to the user
    const profile = await prisma.profiles.findFirst({
      where: {
        id: currentProfileId,
        user_id: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate date range based on period
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

    // Fetch exercise attempts (only dictation attempts)
    const attempts = await prisma.exercices_attempts.findMany({
      where: {
        profile_id: currentProfileId,
        dictation_id: { not: null }, // Only dictation attempts
        created_at: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        created_at: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Fetch conjugaison attempts (only conjugaison attempts)
    const conjugaisonAttempts = await prisma.exercices_attempts.findMany({
      where: {
        profile_id: currentProfileId,
        conjugaison_id: { not: null }, // Only conjugaison attempts
        created_at: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        created_at: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Check if date range spans multiple years
    const startYear = startDate.getFullYear();
    const endYear = now.getFullYear();
    const spansMultipleYears = startYear !== endYear;

    // Helper function to format period key
    const formatPeriodKey = (date: Date): string => {
      switch (dimension) {
        case "day": {
          const dayAbbrevs = ["DI", "LU", "MA", "ME", "JE", "VE", "SA"];
          const dayAbbrev = dayAbbrevs[date.getDay()];
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          // Include year if date range spans multiple years to avoid duplicate keys
          if (spansMultipleYears) {
            const year = date.getFullYear();
            return `${dayAbbrev}|${day}/${month}/${year}`;
          }
          // Format: "LU|25/10" for easy parsing (single year)
          return `${dayAbbrev}|${day}/${month}`;
        }
        case "week": {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
          
          const startDay = String(weekStart.getDate()).padStart(2, '0');
          const startMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
          const startYear = weekStart.getFullYear();
          const endDay = String(weekEnd.getDate()).padStart(2, '0');
          const endMonth = String(weekEnd.getMonth() + 1).padStart(2, '0');
          const endYear = weekEnd.getFullYear();
          
          if (startYear === endYear) {
            return `Semaine ${startDay}/${startMonth} - ${endDay}/${endMonth} ${startYear}`;
          } else {
            return `Semaine ${startDay}/${startMonth}/${startYear} - ${endDay}/${endMonth}/${endYear}`;
          }
        }
        case "month": {
          const monthNames = [
            "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
          ];
          const year = date.getFullYear();
          return `${monthNames[date.getMonth()]} ${year}`;
        }
        default:
          return date.toISOString().split('T')[0];
      }
    };

    // Group and aggregate data based on dimension
    const groupedData = new Map<string, number>();

    attempts.forEach((attempt) => {
      if (!attempt.created_at) return;
      const date = new Date(attempt.created_at);
      const key = formatPeriodKey(date);
      groupedData.set(key, (groupedData.get(key) || 0) + 1);
    });

    // Group and aggregate conjugaison attempts the same way
    const groupedConjugaisons = new Map<string, number>();

    conjugaisonAttempts.forEach((attempt) => {
      if (!attempt.created_at) return;
      const date = new Date(attempt.created_at);
      const key = formatPeriodKey(date);
      groupedConjugaisons.set(key, (groupedConjugaisons.get(key) || 0) + 1);
    });

    // Generate all periods in the range and fill missing ones with 0
    // Store both period key and date for proper sorting
    const allPeriods: Array<{ period: string; attempts: number; conjugaisons: number; date: Date }> = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (dimension === "day") {
      // Generate all days (no filtering)
      const dateIterator = new Date(currentDate);
      
      while (dateIterator <= endDate) {
        const date = new Date(dateIterator);
        const key = formatPeriodKey(date);
        allPeriods.push({
          period: key,
          attempts: groupedData.get(key) || 0,
          conjugaisons: groupedConjugaisons.get(key) || 0,
          date: date,
        });
        dateIterator.setDate(dateIterator.getDate() + 1);
      }
    } else if (dimension === "week") {
      // Generate all weeks
      const dateIterator = new Date(currentDate);
      // Move to start of week
      dateIterator.setDate(dateIterator.getDate() - dateIterator.getDay());
      
      while (dateIterator <= endDate) {
        const date = new Date(dateIterator);
        const key = formatPeriodKey(date);
        allPeriods.push({
          period: key,
          attempts: groupedData.get(key) || 0,
          conjugaisons: groupedConjugaisons.get(key) || 0,
          date: date,
        });
        dateIterator.setDate(dateIterator.getDate() + 7);
      }
    } else if (dimension === "month") {
      // Generate all months
      const dateIterator = new Date(currentDate);
      dateIterator.setDate(1); // Start of month
      
      while (dateIterator <= endDate) {
        const date = new Date(dateIterator);
        const key = formatPeriodKey(date);
        allPeriods.push({
          period: key,
          attempts: groupedData.get(key) || 0,
          conjugaisons: groupedConjugaisons.get(key) || 0,
          date: date,
        });
        dateIterator.setMonth(dateIterator.getMonth() + 1);
      }
    }

    // Convert to array format for chart and sort by date
    const chartData = allPeriods
      .sort((a, b) => {
        // Sort by actual date for proper chronological order including year
        return a.date.getTime() - b.date.getTime();
      })
      .map(({ period, attempts, conjugaisons }) => ({
        period,
        attempts,
        conjugaisons,
      }));

    return NextResponse.json(chartData, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error("Error fetching exercise attempts stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

