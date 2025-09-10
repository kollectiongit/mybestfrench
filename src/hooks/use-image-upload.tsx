import { useCallback, useEffect, useRef, useState } from "react";

interface UseImageUploadProps {
  onUpload?: (url: string) => void;
  bucket?: string;
}

export function useImageUpload({
  onUpload,
  bucket = "avatars",
}: UseImageUploadProps = {}) {
  const previewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        alert("Seuls les fichiers JPG, JPEG et PNG sont autorisés");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Le fichier ne doit pas dépasser 5MB");
        return;
      }

      setFileName(file.name);
      setUploading(true);

      try {
        // Create preview URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        previewRef.current = url;

        // Upload via API route (server-side authentication)
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", bucket);

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const result = await response.json();

        console.log(
          "Image upload hook: Upload successful, calling onUpload with:",
          result.filename
        );
        setUploadedUrl(result.publicUrl);
        setUploadedFilename(result.filename);
        onUpload?.(result.filename); // Pass only the filename, not the full URL
      } catch (error) {
        console.error("Upload error:", error);
        alert("Erreur lors de l'upload du fichier");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, bucket]
  );

  const handleRemove = useCallback(async () => {
    // Delete from Supabase if uploaded
    if (uploadedFilename) {
      try {
        const response = await fetch("/api/delete-image", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: uploadedFilename,
            bucket: bucket,
          }),
        });

        if (!response.ok) {
          console.error("Error deleting file from server");
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }

    // Clean up preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setFileName(null);
    setUploadedUrl(null);
    setUploadedFilename(null);
    previewRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl, uploadedFilename, bucket]);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  return {
    previewUrl,
    fileName,
    uploadedUrl,
    uploadedFilename,
    uploading,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
  };
}
