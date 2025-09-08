import { auth } from "@/lib/auth";
import { clearCurrentProfileCookie, getCurrentProfileFromCookie, setCurrentProfileCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

// POST /api/current-profile - Set current profile
export async function POST(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { profileId } = await request.json();

    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the authenticated user
    const profile = await prisma.profiles.findFirst({
      where: {
        id: profileId,
        user_id: session.user.id,
      },
      include: {
        profile_levels: {
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
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or access denied" },
        { status: 404 }
      );
    }

    // Create response and set the cookie
    const response = NextResponse.json({
      success: true,
      currentProfile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        age: profile.age,
        description: profile.description,
        created_at: profile.created_at?.toISOString() || null,
        updated_at: profile.updated_at?.toISOString() || null,
        profile_levels: profile.profile_levels || [],
      },
    });

    await setCurrentProfileCookie(response, profileId);

    return response;
  } catch (error) {
    console.error("Error setting current profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/current-profile - Get current profile
export async function GET(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Try to get profile ID from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);
    let profile = null;

    if (currentProfileId) {
      // Verify the profile still exists and belongs to the user
      profile = await prisma.profiles.findFirst({
        where: {
          id: currentProfileId,
          user_id: session.user.id,
        },
        include: {
          profile_levels: {
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
      });
    }

    // If no valid profile from cookie, get the most recent profile
    if (!profile) {
      profile = await prisma.profiles.findFirst({
        where: {
          user_id: session.user.id,
        },
        include: {
          profile_levels: {
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
          created_at: 'desc',
        },
      });

      // If we found a fallback profile, set it as current
      if (profile) {
        const response = NextResponse.json({
          currentProfile: {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            age: profile.age,
            description: profile.description,
            created_at: profile.created_at?.toISOString() || null,
            updated_at: profile.updated_at?.toISOString() || null,
            profile_levels: profile.profile_levels || [],
          },
          fromFallback: true,
        });

        await setCurrentProfileCookie(response, profile.id);
        return response;
      }
    }

    if (!profile) {
      return NextResponse.json(
        { currentProfile: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      currentProfile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        age: profile.age,
        description: profile.description,
        created_at: profile.created_at?.toISOString() || null,
        updated_at: profile.updated_at?.toISOString() || null,
        profile_levels: profile.profile_levels || [],
      },
    });
  } catch (error) {
    console.error("Error getting current profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/current-profile - Clear current profile
export async function DELETE(request: NextRequest) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    clearCurrentProfileCookie(response);

    return response;
  } catch (error) {
    console.error("Error clearing current profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
