import { auth } from "@/lib/auth";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/dictations/[id] - Fetch single dictation by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Dictation ID is required" },
        { status: 400 }
      );
    }

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

    // Get current profile from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);

    const dictation = await prisma.dictation.findUnique({
      where: {
        id: id,
      },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            slug: true,
            rules_explanation_message: true,
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
    });

    if (!dictation) {
      return NextResponse.json(
        { error: "Dictation not found" },
        { status: 404 }
      );
    }

    // Fetch exercices_attempts for this dictation and current profile
    let exercicesAttempts: Array<{
      id: string;
      created_at: Date | null;
      correction_total_errors: number | null;
      correction_errors_spelling: number | null;
      correction_errors_grammar: number | null;
      correction_errors_conjugation: number | null;
      correction_errors_percentage: number | null;
      correction_full_json: string | null;
      user_answer: string | null;
    }> = [];
    if (currentProfileId) {
      exercicesAttempts = await prisma.exercices_attempts.findMany({
        where: {
          dictation_id: id,
          profile_id: currentProfileId,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          created_at: true,
          correction_total_errors: true,
          correction_errors_spelling: true,
          correction_errors_grammar: true,
          correction_errors_conjugation: true,
          correction_errors_percentage: true,
          correction_full_json: true,
          user_answer: true,
        },
      });
    }

    return NextResponse.json({
      ...dictation,
      exercicesAttempts,
    });
  } catch (error) {
    console.error("Error fetching dictation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
