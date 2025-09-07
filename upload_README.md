# File Upload API

This API endpoint allows you to upload files from local directories to Supabase storage buckets and automatically move them to uploaded directories.

## API Endpoint

**URL:** `/api/upload-files`  
**Methods:** `GET`, `POST`

## Directory Structure

The API works with the following directory structure:

```
public/
├── files_to_upload/          # Source files (will be uploaded)
│   ├── audio/               # Audio files → uploaded to 'audio' bucket
│   └── images/              # Image files → uploaded to 'images' bucket
└── files_uploaded/          # Destination files (after upload)
    ├── audio/               # Moved audio files
    └── images/              # Moved image files
```

## Usage

### 1. Check Files to Upload (GET)

```bash
curl -X GET http://localhost:3000/api/upload-files
```

**Response:**

```json
{
  "success": true,
  "filesToUpload": {
    "audio": ["file1.mp3", "file2.mp3"],
    "images": ["image1.jpg", "image2.png"]
  },
  "totalFiles": 4
}
```

### 2. Upload Files (POST)

```bash
curl -X POST http://localhost:3000/api/upload-files
```

**Response:**

```json
{
  "success": true,
  "message": "Upload completed. 4 files uploaded successfully, 0 errors occurred.",
  "results": {
    "audio": {
      "uploaded": 2,
      "errors": []
    },
    "images": {
      "uploaded": 2,
      "errors": []
    }
  }
}
```

### 3. Using the Script

A convenient script is provided to run the upload process:

```bash
./upload-files.sh
```

The script will:

- Check if the API is available
- Show how many files are ready to upload
- Upload all files to Supabase
- Show the results
- Confirm files have been moved

## Supported File Types

### Audio Files

- `.mp3` → `audio/mpeg`
- `.wav` → `audio/wav`
- `.ogg` → `audio/ogg`
- `.m4a` → `audio/mp4`

### Image Files

- `.jpg`, `.jpeg` → `image/jpeg`
- `.png` → `image/png`
- `.gif` → `image/gif`
- `.webp` → `image/webp`

## Supabase Buckets

The API automatically creates the following buckets if they don't exist:

- `audio` - for audio files
- `images` - for image files

Both buckets are configured as:

- Public access enabled
- 50MB file size limit
- Files are cached for 1 hour (3600 seconds)

## Process Flow

1. **Check Source Directories**: API reads files from `public/files_to_upload/audio` and `public/files_to_upload/images`

2. **Create Buckets**: If buckets don't exist, they are created automatically

3. **Upload Files**: Each file is uploaded to the appropriate Supabase bucket with proper content type

4. **Move Files**: Successfully uploaded files are moved from `files_to_upload` to `files_uploaded`

5. **Return Results**: API returns detailed results including success count and any errors

## Error Handling

The API handles various error scenarios:

- Missing source directories (skipped gracefully)
- Bucket creation failures
- Individual file upload failures
- File moving failures

Errors are collected and returned in the response, allowing partial success scenarios.

## Environment Variables Required

Make sure these environment variables are set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_SERVICE_KEY`

## Example Workflow

1. Place files in `public/files_to_upload/audio/` and `public/files_to_upload/images/`
2. Run `./upload-files.sh` or make a POST request to `/api/upload-files`
3. Files are uploaded to Supabase and moved to `public/files_uploaded/`
4. Access files via Supabase storage URLs or through your application
