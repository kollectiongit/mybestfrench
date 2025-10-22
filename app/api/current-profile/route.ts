import { auth } from "@/lib/auth";
import { clearCurrentProfileCookie, getCurrentProfileFromCookie, getProfilesFromCacheCookie, setCurrentProfileCookie, setProfilesCacheCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Update cache cookie with fresh data
    const allProfiles = await prisma.profiles.findMany({
      where: { user_id: session.user.id },
      include: {
        profile_levels: {
          include: {
            levels: {
              select: { id: true, code: true, label: true, rank: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formattedProfiles = allProfiles.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      age: p.age,
      description: p.description,
      created_at: p.created_at?.toISOString() || null,
      updated_at: p.updated_at?.toISOString() || null,
      profile_levels: p.profile_levels || [],
    }));

    await setProfilesCacheCookie(response, formattedProfiles);

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

    // Try to get cached profiles first
    const cachedProfiles = await getProfilesFromCacheCookie(request);
    const currentProfileId = await getCurrentProfileFromCookie(request);
    
    // If we have cached data and a current profile ID, try to return cached data
    if (cachedProfiles && currentProfileId) {
      const cachedProfile = cachedProfiles.find(p => p.id === currentProfileId);
      if (cachedProfile) {
        return NextResponse.json({
          currentProfile: cachedProfile,
          fromCache: true,
        });
      }
    }

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
