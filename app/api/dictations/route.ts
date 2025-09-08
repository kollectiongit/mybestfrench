import { auth } from "@/lib/auth";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/dictations - Fetch dictations filtered by current profile levels
export async function GET(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current profile ID from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);
    
    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    // Verify the profile belongs to the user and get its levels
    const profile = await prisma.profiles.findFirst({
      where: {
        id: currentProfileId,
        user_id: session.user.id,
      },
      include: {
        profile_levels: {
          select: {
            level_id: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Extract level IDs from profile
    const profileLevelIds = profile.profile_levels.map(pl => pl.level_id);

    // If no levels are set for the profile, return empty array
    if (profileLevelIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch dictations that have at least one level in common with the profile
    const dictations = await prisma.dictation.findMany({
      where: {
        dictations_levels: {
          some: {
            level_id: {
              in: profileLevelIds,
            },
          },
        },
      },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        dictations_levels: {
          include: {
            levels: {
              select: {
                id: true,
                code: true,
                label: true,
                rank: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json(dictations);
  } catch (error) {
    console.error("Error fetching dictations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
