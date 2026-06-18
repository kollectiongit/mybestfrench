import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

export interface ResolvedProfile {
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  profileId: string;
}

/**
 * Resolves the authenticated session and current profile for a request.
 * Profile id is taken from (in order): explicit arg, `x-current-profile-id`
 * header, signed cookie. Returns either `{ error }` (a ready NextResponse) or
 * `{ session, profileId }`.
 */
export async function resolveProfileForRequest(
  request: NextRequest,
  explicitProfileId?: string | null
): Promise<{ error: NextResponse } | { session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>; profileId: string }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const headerProfileId = request.headers.get("x-current-profile-id");
  const cookieProfileId = await getCurrentProfileFromCookie(request);
  const currentProfileId = explicitProfileId || headerProfileId || cookieProfileId;

  if (!currentProfileId) {
    return { error: NextResponse.json({ error: "No profile selected" }, { status: 400 }) };
  }

  const profile = await prisma.profiles.findFirst({
    where: { id: currentProfileId, user_id: session.user.id },
  });
  if (!profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 404 }) };
  }

  return { session, profileId: currentProfileId };
}

/** Parse a YYYY-MM-DD string into a Date at UTC midnight (for @db.Date columns). */
export function parseDateOnly(s?: string | null): Date | null {
  if (!s) return null;
  const str = s.toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date as YYYY-MM-DD using its UTC parts. */
export function toDateOnlyString(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Today's date (UTC midnight) — used as default when no client date is provided. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/** Parse a numeric value that may have up to 2 decimals. Returns rounded number or null. */
export function parseDecimal(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
