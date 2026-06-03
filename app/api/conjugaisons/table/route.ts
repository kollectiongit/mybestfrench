import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = "force-dynamic";

// GET /api/conjugaisons/table - Grille complète des conjugaisons + agrégats du profil
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentProfileId = await getCurrentProfileFromCookie(request);
    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: currentProfileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const conjugaisons = await prisma.conjugaison.findMany({
      select: {
        id: true,
        infinitif: true,
        groupe: true,
        temps: true,
        personne: true,
      },
    });

    const grouped = await prisma.exercices_attempts.groupBy({
      by: ["conjugaison_id", "is_correct"],
      where: { profile_id: currentProfileId, conjugaison_id: { not: null } },
      _count: { _all: true },
    });

    // conjugaison_id -> { total, success }
    const aggByConjugaison = new Map<number, { total: number; success: number }>();
    for (const g of grouped) {
      if (g.conjugaison_id == null) continue;
      const count = g._count._all;
      const current = aggByConjugaison.get(g.conjugaison_id) ?? {
        total: 0,
        success: 0,
      };
      current.total += count;
      if (g.is_correct) current.success += count;
      aggByConjugaison.set(g.conjugaison_id, current);
    }

    return NextResponse.json({
      cells: conjugaisons.map((c) => {
        const agg = aggByConjugaison.get(c.id);
        return {
          infinitif: c.infinitif,
          groupe: c.groupe,
          temps: c.temps,
          personne: c.personne,
          total: agg?.total ?? 0,
          success: agg?.success ?? 0,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching conjugaison table:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
