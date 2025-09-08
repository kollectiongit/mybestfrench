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

export interface AddProfileFormData {
  first_name: string;
  last_name: string;
  age: string;
  description: string;
}

export default function AddProfileDialog({
  open,
  onOpenChange,
  formData,
  onChange,
  onSubmit,
  avatarFilename,
  setAvatarFilename,
  setSelectedLevelIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: AddProfileFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  avatarFilename: string;
  setAvatarFilename: (v: string) => void;
  setSelectedLevelIds: (v: number[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer un nouveau profil</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">Prénom *</Label>
            <Input
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={onChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Nom</Label>
            <Input
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={onChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Âge</Label>
            <Input
              id="age"
              name="age"
              type="number"
              value={formData.age}
              onChange={onChange}
              min="1"
              max="120"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
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
              initialFilename={avatarFilename}
            />
          </div>
          <div className="space-y-2">
            <ProfileLevelsSelector onLevelsChange={setSelectedLevelIds} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit">Créer le profil</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
