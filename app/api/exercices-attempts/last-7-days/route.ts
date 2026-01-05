import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/exercices-attempts/last-7-days - Get exercise attempts count for the last 7 days
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
    const week = searchParams.get("week") || "current"; // "current" or "previous"

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

    // Calculate date range: current week (Monday to Sunday) or previous week
    const now = new Date();
    const weekStart = new Date(now);
    
    // Get Monday of current week
    // getDay() returns 0 (Sunday) to 6 (Saturday)
    // We want Monday (1) to be day 0, so we adjust: (day + 6) % 7 gives us days from Monday
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday (0) becomes 6, Monday (1) becomes 0
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    if (week === "previous") {
      // Move back 7 days to get previous week's Monday
      weekStart.setDate(weekStart.getDate() - 7);
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday (6 days after Monday)
    weekEnd.setHours(23, 59, 59, 999);

    // Fetch ALL exercise attempts (not just dictations) for the profile
    const attempts = await prisma.exercices_attempts.findMany({
      where: {
        profile_id: currentProfileId,
        created_at: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        created_at: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Group attempts by day
    const dayCounts = new Map<string, number>();
    
    attempts.forEach((attempt) => {
      if (!attempt.created_at) return;
      const date = new Date(attempt.created_at);
      // Normalize to start of day for grouping
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1);
    });

    // Generate the 7 days of the week (Monday to Sunday) with counts
    const dayAbbrevs = ["DI", "LU", "MA", "ME", "JE", "VE", "SA"];
    const result: Array<{ day: string; date: string; count: number }> = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const dateKey = date.toISOString().split('T')[0];
      const dayAbbrev = dayAbbrevs[date.getDay()];
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      result.push({
        day: dayAbbrev,
        date: `${day}/${month}`,
        count: dayCounts.get(dateKey) || 0,
      });
    }

    // Calculate total
    const total = result.reduce((sum, day) => sum + day.count, 0);

    return NextResponse.json(
      { days: result, total },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching last 7 days exercise attempts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

