import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Encouraging keywords — one is picked at random for each celebration.
const KEYWORDS = [
  "congrats",
  "congratulations",
  "bravo",
  "well done",
  "good job",
  "you're the best",
  "excited",
  "celebrate",
  "awesome",
  "yay",
  "proud",
  "victory",
  "high five",
  "happy dance",
  "winner",
];

// GET /api/giphy/random — returns a random encouraging GIF.
// Degrades gracefully to { url: null } when no API key is configured or Giphy
// is unreachable, so the UI can simply skip the celebration.
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { url: null, reason: "no_api_key" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    const url = `https://api.giphy.com/v1/gifs/random?api_key=${encodeURIComponent(
      apiKey
    )}&tag=${encodeURIComponent(keyword)}&rating=g`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { url: null, reason: "giphy_error" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    const data = await res.json();
    const images = data?.data?.images;
    const gifUrl =
      images?.fixed_height?.url ||
      images?.downsized_medium?.url ||
      images?.original?.url ||
      null;

    return NextResponse.json(
      { url: gifUrl, keyword, title: data?.data?.title ?? null },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error fetching random giphy:", error);
    return NextResponse.json(
      { url: null, reason: "exception" },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
