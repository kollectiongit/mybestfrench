import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = 'force-dynamic';

// GET /api/profiles - Always hit the DB (no caching). The previous cookie
// cache stripped fields and caused stale reads after profile edits.
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        created_at: "desc",
      },
    });

    // Format profiles for response
    const formattedProfiles = profiles.map(profile => ({
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      age: profile.age,
      description: profile.description,
      weekly_pages_goal: profile.weekly_pages_goal ?? null,
      created_at: profile.created_at?.toISOString() || null,
      updated_at: profile.updated_at?.toISOString() || null,
      profile_levels: profile.profile_levels || [],
    }));

    return NextResponse.json(formattedProfiles, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/profiles - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { first_name, last_name, avatar_url, age, description } = body;

    // Validate required fields
    if (!first_name) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.create({
      data: {
        user_id: session.user.id,
        first_name,
        last_name,
        avatar_url,
        age: age ? parseInt(age) : null,
        description,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
