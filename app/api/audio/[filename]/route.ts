import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    if (!filename) {
      return new NextResponse("Filename is required", { status: 400 });
    }

    // Download the file from Supabase storage
    const { data, error } = await supabase.storage
      .from("audio")
      .download(filename);

    if (error) {
      console.error("Error downloading file:", error);
      return new NextResponse("File not found", { status: 404 });
    }

    if (!data) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type based on file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    let contentType = 'audio/mpeg'; // default
    
    if (extension === 'wav') {
      contentType = 'audio/wav';
    } else if (extension === 'ogg') {
      contentType = 'audio/ogg';
    } else if (extension === 'm4a') {
      contentType = 'audio/mp4';
    } else if (extension === 'mp3') {
      contentType = 'audio/mpeg';
    }

    // Return the audio with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error("Error serving audio:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
