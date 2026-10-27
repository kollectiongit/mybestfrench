import { auth } from "@/lib/auth";
import { downloadAudio } from "@/lib/tts";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tts/audio/<hash>.mp3 - Cached speech (content-addressed, so cacheable forever)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const match = (await params).file.match(/^([a-f0-9]{64})\.mp3$/);
  if (!match) return new NextResponse("Not found", { status: 404 });

  const audio = await downloadAudio(match[1]);
  if (!audio) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
