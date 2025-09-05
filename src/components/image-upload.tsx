import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/hooks/use-image-upload";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

interface ImageUploadProps {
  onUpload: (filename: string) => void;
  initialFilename?: string;
}

export function ImageUpload({ onUpload, initialFilename }: ImageUploadProps) {
  const {
    previewUrl,
    uploadedUrl,
    uploading,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
  } = useImageUpload({
    onUpload,
    bucket: "avatars",
  });

  const [isDragging, setIsDragging] = useState(false);

  // Generate public URL from filename
  const getPublicUrl = (filename: string) => {
    if (!filename) return null;
    return `/api/avatars/${filename}`;
  };

  const displayUrl =
    uploadedUrl || (initialFilename ? getPublicUrl(initialFilename) : null);

  // Show drop zone if no image is displayed
  const hasImage = displayUrl || previewUrl;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        const fakeEvent = {
          target: {
            files: [file],
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(fakeEvent);
      }
    },
    [handleFileChange]
  );

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Photo de profil</label>
        <p className="text-xs text-muted-foreground">
          Formats supportés: JPG, JPEG, PNG (max 5MB)
        </p>
      </div>

      <Input
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {!hasImage ? (
        <div
          onClick={handleThumbnailClick}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:bg-muted",
            isDragging && "border-primary/50 bg-primary/5",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="rounded-full bg-background p-2 shadow-sm">
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium">
              {uploading ? "Upload..." : "Cliquez"}
            </p>
            <p className="text-xs text-muted-foreground">ou glissez-déposez</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="group relative h-32 w-32 overflow-hidden rounded-lg border">
            <Image
              src={previewUrl || displayUrl || ""}
              alt="Preview"
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="128px"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleThumbnailClick}
                className="h-8 w-8 p-0"
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  handleRemove();
                  onUpload("");
                }}
                className="h-8 w-8 p-0"
                disabled={uploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
