"use client";

import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditIcon, PlusIcon, TrashIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface Profile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  age: number | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    age: "",
    description: "",
  });
  const [avatarFilename, setAvatarFilename] = useState<string>("");

  // Generate public URL from filename
  const getPublicUrl = (filename: string | null) => {
    if (!filename) return null;
    return `/api/avatars/${filename}`;
  };

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      } else {
        console.error("Failed to fetch profiles");
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          avatar_url: avatarFilename,
        }),
      });

      if (response.ok) {
        const newProfile = await response.json();
        setProfiles([newProfile, ...profiles]);
        setFormData({
          first_name: "",
          last_name: "",
          age: "",
          description: "",
        });
        setAvatarFilename("");
        setIsDialogOpen(false);
      } else {
        console.error("Failed to create profile");
      }
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      first_name: profile.first_name,
      last_name: profile.last_name || "",
      age: profile.age?.toString() || "",
      description: profile.description || "",
    });
    setAvatarFilename(profile.avatar_url || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProfile) return;

    try {
      const response = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          avatar_url: avatarFilename,
        }),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfiles(
          profiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
        );
        setIsEditDialogOpen(false);
        setEditingProfile(null);
        setFormData({
          first_name: "",
          last_name: "",
          age: "",
          description: "",
        });
        setAvatarFilename("");
      } else {
        console.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleDeleteClick = (profile: Profile) => {
    setProfileToDelete(profile);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;

    try {
      const response = await fetch(`/api/profiles/${profileToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProfiles(profiles.filter((p) => p.id !== profileToDelete.id));
        setDeleteConfirmOpen(false);
        setProfileToDelete(null);
      } else {
        console.error("Failed to delete profile");
      }
    } catch (error) {
      console.error("Error deleting profile:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des profils...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes Profils</h1>
        <p className="text-gray-600">
          Créez un profil différent pour chaque personne qui veut réviser
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 -ml-4 sm:-ml-6 lg:-ml-8">
        {/* Add New Profile Card */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Card
            className="h-80 w-full max-w-80 cursor-pointer border-dashed border-2 border-gray-300 hover:border-gray-400 ml-4 sm:ml-6 lg:ml-8"
            onClick={() => setIsDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center h-full p-6">
              <PlusIcon className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">
                Créer un nouveau profil
              </h3>
            </CardContent>
          </Card>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer un nouveau profil</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  value={formData.age}
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit">Créer le profil</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Existing Profiles */}
        {profiles.map((profile) => (
          <Card
            key={profile.id}
            className="h-80 w-full max-w-80 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer group relative overflow-hidden ml-4 sm:ml-6 lg:ml-8"
            onClick={() => handleEditProfile(profile)}
          >
            {/* Edit Button - Top Right */}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleEditProfile(profile);
              }}
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0 z-10"
            >
              <EditIcon className="h-4 w-4" />
            </Button>

            {/* Background Glow Effect */}
            <div className="absolute inset-0 rounded-lg -z-10 transition-all duration-500 ease-out blur-2xl opacity-30 bg-gradient-to-r from-indigo-500/50 to-purple-500/50" />

            <CardContent className="flex flex-col items-center justify-center h-full p-6 relative backdrop-blur-sm bg-card/40">
              {/* Avatar */}
              <div className="w-20 h-20 mb-4 rounded-full p-1 border-2 border-white/20">
                {profile.avatar_url ? (
                  <Image
                    src={getPublicUrl(profile.avatar_url) || ""}
                    alt={`${profile.first_name} ${profile.last_name || ""}`}
                    width={80}
                    height={80}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Name */}
              <h2 className="text-xl font-bold text-card-foreground text-center mb-2">
                {profile.first_name} {profile.last_name || ""}
              </h2>

              {/* Age */}
              {profile.age && (
                <p className="text-sm font-medium text-primary mb-3">
                  {profile.age} ans
                </p>
              )}

              {/* Description */}
              {profile.description && (
                <>
                  <div className="w-1/2 h-px mb-3 rounded-full bg-border" />
                  <p className="text-center text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {profile.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_first_name">Prénom *</Label>
              <Input
                id="edit_first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_last_name">Nom</Label>
              <Input
                id="edit_last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_age">Âge</Label>
              <Input
                id="edit_age"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleInputChange}
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
                onChange={handleInputChange}
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

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  handleDeleteClick(editingProfile!);
                }}
                disabled={!editingProfile}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit">Mettre à jour</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Supprimer le profil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Êtes-vous sûr de vouloir supprimer le profil de{" "}
              <strong>
                {profileToDelete?.first_name} {profileToDelete?.last_name || ""}
              </strong>
              ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeleteProfile}>
                Supprimer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
