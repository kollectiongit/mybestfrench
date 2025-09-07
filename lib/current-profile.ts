import { headers } from "next/headers";
import { PrismaClient } from "../app/generated/prisma";
import { auth } from "./auth";

const prisma = new PrismaClient();

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

    // Try to get profile ID from middleware headers
    const headersList = await headers();
    const currentProfileId = headersList.get('x-current-profile-id');
    
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
