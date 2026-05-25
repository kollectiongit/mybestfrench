import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseDateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// GET /api/lecture/earnings?week_start=YYYY-MM-DD (Monday of the current week)
// Returns, per profile: cumulative earnings (all weeks) and current-week earnings.
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("week_start");
    let weekStart: Date | null = null;
    let weekEnd: Date | null = null;
    if (weekStartParam) {
      weekStart = parseDateOnly(weekStartParam);
      if (!weekStart) {
        return NextResponse.json(
          { error: "Invalid week_start" },
          { status: 400 }
        );
      }
      weekEnd = addDays(weekStart, 6);
    }

    const profiles = await prisma.profiles.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "asc" },
      include: {
        books: true,
        reading_logs: {
          select: { book_id: true, pages_read_count: true, read_date: true },
        },
      },
    });

    const result = profiles.map((p) => {
      const rateByBook = new Map<number, number>();
      let currency: string | null = null;
      for (const b of p.books) {
        if (b.remuneration_per_page != null) {
          rateByBook.set(b.id, Number(b.remuneration_per_page));
        }
        if (!currency && b.currency) currency = b.currency;
      }

      let total = 0;
      let currentWeek = 0;
      for (const log of p.reading_logs) {
        const rate = rateByBook.get(log.book_id);
        if (!rate) continue;
        const gain = log.pages_read_count * rate;
        total += gain;
        if (
          weekStart &&
          weekEnd &&
          log.read_date >= weekStart &&
          log.read_date <= weekEnd
        ) {
          currentWeek += gain;
        }
      }

      return {
        id: p.id,
        first_name: p.first_name,
        currency,
        total: round2(total),
        current_week: round2(currentWeek),
      };
    });

    return NextResponse.json({ profiles: result });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
