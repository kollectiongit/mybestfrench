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

function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/lecture/week?week_start=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("week_start");
    if (!weekStartParam) {
      return NextResponse.json(
        { error: "week_start is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const weekStart = parseDateOnly(weekStartParam);
    if (!weekStart) {
      return NextResponse.json(
        { error: "Invalid week_start" },
        { status: 400 }
      );
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const profiles = await prisma.profiles.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "asc" },
      include: {
        books: { orderBy: { created_at: "desc" } },
        active_book: true,
        active_book_2: true,
        reading_logs: {
          where: { read_date: { gte: weekStart, lte: weekEnd } },
        },
      },
    });

    const result = profiles.map((p) => {
      // logs nested by date -> book_id -> log
      const logsByDate: Record<
        string,
        Record<
          string,
          { id: number; page_number: number; pages_read_count: number }
        >
      > = {};
      for (const log of p.reading_logs) {
        const key = toDateOnlyString(log.read_date);
        if (!logsByDate[key]) logsByDate[key] = {};
        logsByDate[key][String(log.book_id)] = {
          id: log.id,
          page_number: log.page_number,
          pages_read_count: log.pages_read_count,
        };
      }

      const activeBooks: {
        slot: 1 | 2;
        id: number;
        title: string;
        start_page: number;
        remuneration_per_page: number | null;
        currency: string | null;
      }[] = [];
      if (p.active_book) {
        activeBooks.push({
          slot: 1,
          id: p.active_book.id,
          title: p.active_book.title,
          start_page: p.active_book.start_page,
          remuneration_per_page:
            p.active_book.remuneration_per_page != null
              ? Number(p.active_book.remuneration_per_page)
              : null,
          currency: p.active_book.currency,
        });
      }
      if (p.active_book_2) {
        activeBooks.push({
          slot: 2,
          id: p.active_book_2.id,
          title: p.active_book_2.title,
          start_page: p.active_book_2.start_page,
          remuneration_per_page:
            p.active_book_2.remuneration_per_page != null
              ? Number(p.active_book_2.remuneration_per_page)
              : null,
          currency: p.active_book_2.currency,
        });
      }

      return {
        id: p.id,
        first_name: p.first_name,
        avatar_url: p.avatar_url,
        weekly_pages_goal: p.weekly_pages_goal,
        active_books: activeBooks,
        books: p.books.map((b) => ({
          id: b.id,
          title: b.title,
          start_page: b.start_page,
          remuneration_per_page:
            b.remuneration_per_page != null
              ? Number(b.remuneration_per_page)
              : null,
          currency: b.currency,
          created_at: b.created_at.toISOString(),
        })),
        logs: logsByDate,
      };
    });

    return NextResponse.json({ profiles: result });
  } catch (error) {
    console.error("Error fetching lecture week:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
