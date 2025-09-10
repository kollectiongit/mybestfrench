"use client";

import { useProfile } from "@/contexts/profile-context";
import { CurrentProfile, ProfileLevel } from "@/lib/current-profile";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AddProfileDialog from "./components/add-profile-dialog";
import DeleteConfirmationDialog from "./components/delete-confirmation-dialog";
import EditProfileDialog from "./components/edit-profile-dialog";
import ExistingProfileCard from "./components/existing-profile-card";
import NewProfileCard from "./components/new-profile-card";

export default function ProfilesPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    allProfiles,
    currentProfile,
    setCurrentProfile,
    refreshProfiles,
    isLoading,
  } = useProfile();

  const [profiles, setProfiles] = useState<CurrentProfile[]>(allProfiles);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CurrentProfile | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<CurrentProfile | null>(
    null
  );
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    age: "",
    description: "",
  });
  const [avatarFilename, setAvatarFilename] = useState<string>("");
  const [selectedLevelIds, setSelectedLevelIds] = useState<number[]>([]);

  useEffect(() => {
    const message = searchParams.get("message");
    if (message === "profile-required") {
      const toastKey = `toast-shown-${window.location.pathname}`;
      const hasShownToast = sessionStorage.getItem(toastKey);
      if (!hasShownToast) {
        toast.error("Vous devez d'abord créer un profil");
        sessionStorage.setItem(toastKey, "true");
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  useEffect(() => {
    setProfiles(allProfiles);
  }, [allProfiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, avatar_url: avatarFilename }),
      });
      if (response.ok) {
        const newProfile = await response.json();
        setProfiles([newProfile, ...profiles]);
        if (newProfile.id) {
          await setCurrentProfile(newProfile.id);
          if (selectedLevelIds.length > 0) {
            await fetch(`/api/profiles/${newProfile.id}/levels`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ level_ids: selectedLevelIds }),
            });
          }
        }
        setFormData({
          first_name: "",
          last_name: "",
          age: "",
          description: "",
        });
        setAvatarFilename("");
        setSelectedLevelIds([]);
        setIsDialogOpen(false);
        await refreshProfiles();
        router.refresh();
        toast.success("Profil créé avec succès");
      } else {
        toast.error("Erreur lors de la création du profil");
      }
    } catch {
      toast.error("Erreur lors de la création du profil");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateProfileClick = () => {
    setFormData({ first_name: "", last_name: "", age: "", description: "" });
    setAvatarFilename("");
    setSelectedLevelIds([]);
    setIsDialogOpen(true);
  };

  const handleEditProfile = (profile: CurrentProfile) => {
    setEditingProfile(profile);
    setFormData({
      first_name: profile.first_name,
      last_name: profile.last_name || "",
      age: profile.age?.toString() || "",
      description: profile.description || "",
    });
    setAvatarFilename(profile.avatar_url || "");
    console.log(
      "Frontend: Setting avatar filename to:",
      profile.avatar_url || ""
    );
    const initialLevelIds =
      profile.profile_levels?.map((pl: ProfileLevel) => pl.level_id) || [];
    setSelectedLevelIds(initialLevelIds);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    try {
      const updateData = { ...formData, avatar_url: avatarFilename };
      console.log("Frontend: Updating profile with data:", updateData);

      const response = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (response.ok) {
        const updatedProfile = await response.json();
        await fetch(`/api/profiles/${editingProfile.id}/levels`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level_ids: selectedLevelIds }),
        });
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
        setSelectedLevelIds([]);
        await refreshProfiles();
        router.refresh();
        toast.success("Profil mis à jour");
      } else {
        toast.error("Erreur lors de la mise à jour du profil");
      }
    } catch {
      toast.error("Erreur lors de la mise à jour du profil");
    }
  };

  const handleDeleteClick = (profile: CurrentProfile) => {
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
        await refreshProfiles();
      }
    } catch {}
  };

  if (isLoading) {
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
          Sélectionne ou crée le profil qui fera la dictée
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 -ml-4 sm:-ml-6 lg:-ml-8">
        <AddProfileDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setFormData({
                first_name: "",
                last_name: "",
                age: "",
                description: "",
              });
              setAvatarFilename("");
              setSelectedLevelIds([]);
            }
          }}
          formData={formData}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          avatarFilename={avatarFilename}
          setAvatarFilename={setAvatarFilename}
          setSelectedLevelIds={setSelectedLevelIds}
        />

        <NewProfileCard onClick={handleCreateProfileClick} />

        {profiles.map((profile) => (
          <ExistingProfileCard
            key={profile.id}
            profile={profile}
            isCurrent={currentProfile?.id === profile.id}
            onSelect={() => setCurrentProfile(profile.id, false)}
            onEdit={() => handleEditProfile(profile)}
          />
        ))}
      </div>

      <EditProfileDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        onChange={handleInputChange}
        onSubmit={handleUpdateProfile}
        avatarFilename={avatarFilename}
        setAvatarFilename={setAvatarFilename}
        editingProfile={editingProfile}
        onDelete={() => {
          setIsEditDialogOpen(false);
          if (editingProfile) handleDeleteClick(editingProfile);
        }}
        setSelectedLevelIds={setSelectedLevelIds}
      />

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        profileToDelete={profileToDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteProfile}
      />
    </div>
  );
}
