import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { getCurrentProfileCookieName, verifySignedValue } from "./profile-cookies";

/**
 * Resolves the selected profile id for SSR.
 *
 * The middleware sets an `x-current-profile-id` header, but middleware only
 * runs on matched routes and historically did not forward the header to the
 * request, so SSR could silently fall back to the most recent profile. To be
 * robust on every route we also read (and verify) the signed `current_profile`
 * cookie directly.
 */
async function resolveSelectedProfileId(): Promise<string | null> {
  const headersList = await headers();
  const headerProfileId = headersList.get("x-current-profile-id");
  if (headerProfileId) return headerProfileId;

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  const cookieStore = await cookies();
  const signed = cookieStore.get(getCurrentProfileCookieName())?.value;
  if (!signed) return null;
  return verifySignedValue(signed, secret);
}

export interface Level {
  id: number;
  code: string;
  label: string;
  rank: number;
}

export interface ProfileLevel {
  id: number;
  profile_id: string;
  level_id: number;
  levels: Level;
}

export interface CurrentProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  age: number | null;
  description: string | null;
  weekly_pages_goal: number | null;
  conjugaison_show_radical: boolean;
  conjugaison_groupes: number[];
  created_at: string | null;
  updated_at: string | null;
  profile_levels?: ProfileLevel[];
}

/**
 * Gets the current profile for SSR/Server Components
 * This function should be called from Server Components or API routes
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return null;
    }

    // Resolve the selected profile id from the middleware header or, as a
    // robust fallback that works on every route, the signed cookie.
    const currentProfileId = await resolveSelectedProfileId();

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

    // If no valid profile from headers, get the most recent profile
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
    }

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      age: profile.age,
      description: profile.description,
      weekly_pages_goal: profile.weekly_pages_goal ?? null,
      conjugaison_show_radical: profile.conjugaison_show_radical ?? true,
      conjugaison_groupes: profile.conjugaison_groupes ?? [1, 2, 3],
      created_at: profile.created_at?.toISOString() || null,
      updated_at: profile.updated_at?.toISOString() || null,
      profile_levels: profile.profile_levels || [],
    };
  } catch (error) {
    console.error("Error getting current profile in SSR:", error);
    return null;
  }
}

/**
 * Gets all profiles for the authenticated user (SSR)
 */
export async function getUserProfiles(): Promise<CurrentProfile[]> {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return [];
    }

    const profiles = await prisma.profiles.findMany({
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

    return profiles.map((profile) => ({
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      age: profile.age,
      description: profile.description,
      weekly_pages_goal: profile.weekly_pages_goal ?? null,
      conjugaison_show_radical: profile.conjugaison_show_radical ?? true,
      conjugaison_groupes: profile.conjugaison_groupes ?? [1, 2, 3],
      created_at: profile.created_at?.toISOString() || null,
      updated_at: profile.updated_at?.toISOString() || null,
      profile_levels: profile.profile_levels || [],
    }));
  } catch (error) {
    console.error("Error getting user profiles in SSR:", error);
    return [];
  }
}

/**
 * Checks if the user is authenticated (SSR)
 */
export async function isUserAuthenticated(): Promise<boolean> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return !!session;
  } catch (error) {
    console.error("Error checking authentication in SSR:", error);
    return false;
  }
}
