import { auth } from "@/lib/auth";
import { isValidCurrency } from "@/lib/currencies";
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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// The Sunday that closes the Monday→Sunday week containing `d`.
function owningSunday(d: Date): Date {
  const daysUntilSunday = (7 - d.getUTCDay()) % 7;
  return addDays(d, daysUntilSunday);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// GET /api/lecture/payments?end_sunday=YYYY-MM-DD&weeks=10
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endParam = searchParams.get("end_sunday");
    const weeksRaw = Number(searchParams.get("weeks"));
    const weeks =
      Number.isFinite(weeksRaw) && weeksRaw > 0 && weeksRaw <= 52
        ? Math.trunc(weeksRaw)
        : 10;

    let endSunday: Date;
    if (endParam) {
      const parsed = parseDateOnly(endParam);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid end_sunday" },
          { status: 400 }
        );
      }
      endSunday = parsed;
    } else {
      const now = new Date();
      const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      // Most recent Sunday on or before today.
      endSunday = addDays(today, -today.getUTCDay());
    }

    // Sundays from oldest (top) to newest (bottom = endSunday).
    const sundays: Date[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      sundays.push(addDays(endSunday, -7 * i));
    }
    const firstSunday = sundays[0];
    const rangeStart = addDays(firstSunday, -6); // Monday of the first week
    const rangeEnd = endSunday;
    const sundayIsos = sundays.map(toDateOnlyString);

    const profiles = await prisma.profiles.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "asc" },
      include: {
        books: { orderBy: { created_at: "desc" } },
        reading_logs: {
          where: { read_date: { gte: rangeStart, lte: rangeEnd } },
        },
        weekly_payments: {
          where: { week_sunday: { gte: firstSunday, lte: rangeEnd } },
        },
      },
    });

    const result = profiles.map((p) => {
      const remunerationByBook = new Map<number, number>();
      let currency: string | null = null;
      for (const b of p.books) {
        if (b.remuneration_per_page != null) {
          remunerationByBook.set(b.id, Number(b.remuneration_per_page));
        }
        if (!currency && b.currency) currency = b.currency;
      }

      const owedBySunday: Record<string, number> = {};
      for (const log of p.reading_logs) {
        const rate = remunerationByBook.get(log.book_id);
        if (!rate) continue;
        const sundayIso = toDateOnlyString(owningSunday(log.read_date));
        owedBySunday[sundayIso] =
          (owedBySunday[sundayIso] || 0) + log.pages_read_count * rate;
      }

      const paidBySunday: Record<string, number> = {};
      for (const wp of p.weekly_payments) {
        paidBySunday[toDateOnlyString(wp.week_sunday)] = Number(wp.amount_paid);
      }

      const byWeek: Record<
        string,
        { owed: number; paid: number | null }
      > = {};
      for (const iso of sundayIsos) {
        byWeek[iso] = {
          owed: round2(owedBySunday[iso] || 0),
          paid: iso in paidBySunday ? round2(paidBySunday[iso]) : null,
        };
      }

      return {
        id: p.id,
        first_name: p.first_name,
        currency,
        byWeek,
      };
    });

    return NextResponse.json({ weeks: sundayIsos, profiles: result });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/lecture/payments  { profile_id, week_sunday, amount_paid, currency }
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const profileId: string | undefined = body.profile_id;
    const weekSundayStr: string | undefined = body.week_sunday;

    if (!profileId || !weekSundayStr) {
      return NextResponse.json(
        { error: "profile_id and week_sunday are required" },
        { status: 400 }
      );
    }
    const weekSunday = parseDateOnly(weekSundayStr);
    if (!weekSunday || weekSunday.getUTCDay() !== 0) {
      return NextResponse.json(
        { error: "week_sunday must be a Sunday (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currency: string | null =
      body.currency == null || body.currency === ""
        ? null
        : isValidCurrency(body.currency)
          ? body.currency
          : null;

    // Empty / null amount clears the payment.
    if (body.amount_paid === null || body.amount_paid === "") {
      await prisma.weekly_payments
        .delete({
          where: {
            profile_id_week_sunday: {
              profile_id: profileId,
              week_sunday: weekSunday,
            },
          },
        })
        .catch(() => {});
      return NextResponse.json({ success: true, payment: null });
    }

    const amount = Number(body.amount_paid);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "amount_paid must be a positive number" },
        { status: 400 }
      );
    }
    const amountPaid = round2(amount);

    const payment = await prisma.weekly_payments.upsert({
      where: {
        profile_id_week_sunday: {
          profile_id: profileId,
          week_sunday: weekSunday,
        },
      },
      update: { amount_paid: amountPaid, currency },
      create: {
        profile_id: profileId,
        week_sunday: weekSunday,
        amount_paid: amountPaid,
        currency,
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        profile_id: payment.profile_id,
        week_sunday: toDateOnlyString(payment.week_sunday),
        amount_paid: Number(payment.amount_paid),
        currency: payment.currency,
      },
    });
  } catch (error) {
    console.error("Error saving payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
