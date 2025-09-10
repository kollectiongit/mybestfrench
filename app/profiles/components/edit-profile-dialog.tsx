"use client";

import { ImageUpload } from "@/components/image-upload";
import ProfileLevelsSelector from "@/components/profile-levels-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrentProfile } from "@/lib/current-profile";
import { TrashIcon } from "lucide-react";

export interface EditProfileFormData {
  first_name: string;
  last_name: string;
  age: string;
  description: string;
}

export default function EditProfileDialog({
  open,
  onOpenChange,
  formData,
  onChange,
  onSubmit,
  avatarFilename,
  setAvatarFilename,
  onUploadStateChange,
  isUploading,
  editingProfile,
  onDelete,
  setSelectedLevelIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EditProfileFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  avatarFilename: string;
  setAvatarFilename: (v: string) => void;
  onUploadStateChange: (isUploading: boolean) => void;
  isUploading: boolean;
  editingProfile: CurrentProfile | null;
  onDelete: () => void;
  setSelectedLevelIds: (v: number[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier le profil</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_first_name">Prénom *</Label>
            <Input
              id="edit_first_name"
              name="first_name"
              value={formData.first_name}
              onChange={onChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_last_name">Nom</Label>
            <Input
              id="edit_last_name"
              name="last_name"
              value={formData.last_name}
              onChange={onChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_age">Âge</Label>
            <Input
              id="edit_age"
              name="age"
              type="number"
              value={formData.age}
              onChange={onChange}
              min="1"
              max="120"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_description">Description</Label>
            <textarea
              id="edit_description"
              name="description"
              value={formData.description}
              onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <ImageUpload
              onUpload={setAvatarFilename}
              onUploadStateChange={onUploadStateChange}
              initialFilename={avatarFilename}
            />
          </div>
          <div className="space-y-2">
            <ProfileLevelsSelector
              profileId={editingProfile?.id || ""}
              onLevelsChange={setSelectedLevelIds}
            />
          </div>
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={!editingProfile}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Mise à jour en cours..." : "Mettre à jour"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
