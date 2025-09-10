import { createClient } from "@/utils/supabase/server";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import path from "path";

// Define the source and destination paths
const SOURCE_AUDIO_DIR = path.join(process.cwd(), "public", "files_to_upload", "audio");
const SOURCE_IMAGES_DIR = path.join(process.cwd(), "public", "files_to_upload", "images");
const DEST_AUDIO_DIR = path.join(process.cwd(), "public", "files_uploaded", "audio");
const DEST_IMAGES_DIR = path.join(process.cwd(), "public", "files_uploaded", "images");

// Ensure destination directories exist
async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(DEST_AUDIO_DIR, { recursive: true });
    await fs.mkdir(DEST_IMAGES_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating destination directories:", error);
  }
}

// Get content type based on file extension
function getContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

// Upload files from a directory to Supabase bucket
async function uploadFilesFromDirectory(
  sourceDir: string,
  bucketName: string,
  destDir: string
): Promise<{ success: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  try {
    // Check if source directory exists
    try {
      await fs.access(sourceDir);
    } catch {
      console.log(`Source directory ${sourceDir} does not exist, skipping...`);
      return { success: 0, errors: [] };
    }

    // Read files from source directory
    const files = await fs.readdir(sourceDir);
    
    if (files.length === 0) {
      console.log(`No files found in ${sourceDir}`);
      return { success: 0, errors: [] };
    }

    // Ensure bucket exists
    const supabase = await createClient(await cookies());
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: { name: string }) => b.name === bucketName);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(
        bucketName,
        {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        }
      );

      if (createError) {
        errors.push(`Failed to create bucket ${bucketName}: ${createError.message}`);
        return { success: 0, errors };
      }
    }

    // Process each file
    for (const filename of files) {
      try {
        const filePath = path.join(sourceDir, filename);
        const fileBuffer = await fs.readFile(filePath);
        
        // Upload to Supabase
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filename, fileBuffer, {
            cacheControl: "3600",
            upsert: false,
            contentType: getContentType(filename),
          });

        if (uploadError) {
          errors.push(`Failed to upload ${filename}: ${uploadError.message}`);
          continue;
        }

        // Move file to destination directory
        const destPath = path.join(destDir, filename);
        await fs.rename(filePath, destPath);
        
        successCount++;
        console.log(`Successfully uploaded and moved ${filename}`);
      } catch (error) {
        const errorMessage = `Error processing ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }
  } catch (error) {
    const errorMessage = `Error reading directory ${sourceDir}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMessage);
    console.error(errorMessage);
  }

  return { success: successCount, errors };
}

export async function POST() {
  try {
    // Ensure destination directories exist
    await ensureDirectoriesExist();

    const results = {
      audio: { success: 0, errors: [] as string[] },
      images: { success: 0, errors: [] as string[] },
    };

    // Upload audio files
    console.log("Starting audio files upload...");
    results.audio = await uploadFilesFromDirectory(
      SOURCE_AUDIO_DIR,
      "audio",
      DEST_AUDIO_DIR
    );

    // Upload image files
    console.log("Starting image files upload...");
    results.images = await uploadFilesFromDirectory(
      SOURCE_IMAGES_DIR,
      "images",
      DEST_IMAGES_DIR
    );

    const totalSuccess = results.audio.success + results.images.success;
    const totalErrors = results.audio.errors.length + results.images.errors.length;

    return NextResponse.json({
      success: true,
      message: `Upload completed. ${totalSuccess} files uploaded successfully, ${totalErrors} errors occurred.`,
      results: {
        audio: {
          uploaded: results.audio.success,
          errors: results.audio.errors,
        },
        images: {
          uploaded: results.images.success,
          errors: results.images.errors,
        },
      },
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error during upload",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check the status of files to upload
export async function GET() {
  try {
    const audioFiles: string[] = [];
    const imageFiles: string[] = [];

    // Check audio files
    try {
      await fs.access(SOURCE_AUDIO_DIR);
      const audioDirFiles = await fs.readdir(SOURCE_AUDIO_DIR);
      audioFiles.push(...audioDirFiles);
    } catch {
      // Directory doesn't exist or is empty
    }

    // Check image files
    try {
      await fs.access(SOURCE_IMAGES_DIR);
      const imageDirFiles = await fs.readdir(SOURCE_IMAGES_DIR);
      imageFiles.push(...imageDirFiles);
    } catch {
      // Directory doesn't exist or is empty
    }

    return NextResponse.json({
      success: true,
      filesToUpload: {
        audio: audioFiles,
        images: imageFiles,
      },
      totalFiles: audioFiles.length + imageFiles.length,
    });
  } catch (error) {
    console.error("Error checking files:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error checking files to upload",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
