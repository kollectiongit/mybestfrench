import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mondayOfCurrentWeekUtc(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - offset
    )
  );
}

// GET /api/lecture/goal-progress?profile_id=...
// Returns the current week's reading total vs the profile's weekly goal.
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
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
      select: { id: true, first_name: true, weekly_pages_goal: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const weekStart = mondayOfCurrentWeekUtc();
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const agg = await prisma.reading_logs.aggregate({
      where: {
        profile_id: profile.id,
        read_date: { gte: weekStart, lte: weekEnd },
      },
      _sum: { pages_read_count: true },
    });
    const pagesRead = agg._sum.pages_read_count ?? 0;

    return NextResponse.json({
      profile_id: profile.id,
      first_name: profile.first_name,
      weekly_pages_goal: profile.weekly_pages_goal,
      pages_read: pagesRead,
      week_start: weekStart.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching goal progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
