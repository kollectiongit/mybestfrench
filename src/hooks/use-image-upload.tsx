import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split(".").pop();
    return `profile_${timestamp}_${randomString}.${extension}`;
  };

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

        // Upload to Supabase
        const uniqueFileName = generateUniqueFileName(file.name);

        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === bucket);

        if (!bucketExists) {
          const { error: createError } = await supabase.storage.createBucket(
            bucket,
            {
              public: true,
              allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png"],
              fileSizeLimit: 5242880, // 5MB
            }
          );

          if (createError) {
            console.error("Bucket creation error:", createError);
            alert("Erreur lors de la création du bucket de stockage");
            setUploading(false);
            return;
          }
        }

        const { error } = await supabase.storage
          .from(bucket)
          .upload(uniqueFileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          console.error("Upload error:", error);
          alert("Erreur lors de l'upload du fichier");
          setUploading(false);
          return;
        }

        // Get public URL
        const { data: publicData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uniqueFileName);

        const publicUrl = publicData.publicUrl;
        setUploadedUrl(publicUrl);
        setUploadedFilename(uniqueFileName);
        onUpload?.(uniqueFileName); // Pass only the filename, not the full URL
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
        await supabase.storage.from(bucket).remove([uploadedFilename]);
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
