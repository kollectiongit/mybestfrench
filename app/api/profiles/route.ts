import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/profiles - Fetch user's profiles
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
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json(profiles);
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
