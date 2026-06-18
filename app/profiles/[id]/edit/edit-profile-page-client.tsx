"use client";

import { useProfile } from "@/contexts/profile-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, ListChecks, TrashIcon, User } from "lucide-react";
import { GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import ConjugaisonSettings from "../../components/conjugaison-settings";
import { ImageUpload } from "../../components/image-upload";
import ProfileBooksManager from "../../components/profile-books-manager";
import ProfileLevelsSelector from "../../components/profile-levels-selector";
import TodoManager from "../../components/todo-manager";

interface InitialProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  age: number | null;
  description: string | null;
  weekly_pages_goal: number | null;
  conjugaison_show_radical: boolean;
  conjugaison_groupes: number[];
}

const SECTIONS = [
  { id: "infos", label: "Profil", icon: User },
  { id: "apprentissage", label: "Apprentissage", icon: GraduationCap },
  { id: "livres", label: "Livres", icon: BookOpen },
  { id: "suivi", label: "Suivi (To-Do)", icon: ListChecks },
];

export default function EditProfilePageClient({
  initialProfile,
}: {
  initialProfile: InitialProfile;
}) {
  const router = useRouter();
  const { refreshProfiles } = useProfile();

  const [form, setForm] = useState({
    first_name: initialProfile.first_name,
    last_name: initialProfile.last_name ?? "",
    age: initialProfile.age?.toString() ?? "",
    description: initialProfile.description ?? "",
    weekly_pages_goal:
      initialProfile.weekly_pages_goal != null
        ? String(initialProfile.weekly_pages_goal)
        : "",
  });
  const [showRadical, setShowRadical] = useState(
    initialProfile.conjugaison_show_radical
  );
  const [groupes, setGroupes] = useState<number[]>(
    initialProfile.conjugaison_groupes
  );
  const [avatarFilename, setAvatarFilename] = useState(
    initialProfile.avatar_url ?? ""
  );
  const [isUploading, setIsUploading] = useState(false);
  const [selectedLevelIds, setSelectedLevelIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("infos");

  // Scroll-spy: highlight the link of the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveInfos = useCallback(async () => {
    if (!form.first_name.trim()) {
      toast.error("Le prénom est obligatoire");
      return;
    }
    if (isUploading) {
      toast.message("Téléversement de l'image en cours…");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/profiles/${initialProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          avatar_url: avatarFilename,
          conjugaison_show_radical: showRadical,
          conjugaison_groupes: groupes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de la mise à jour du profil");
        return;
      }
      await fetch(`/api/profiles/${initialProfile.id}/levels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level_ids: selectedLevelIds }),
      });
      await refreshProfiles();
      router.refresh();
      toast.success("Profil mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    avatarFilename,
    showRadical,
    groupes,
    selectedLevelIds,
    isUploading,
    initialProfile.id,
    refreshProfiles,
    router,
  ]);

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Supprimer le profil « ${initialProfile.first_name} » ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/profiles/${initialProfile.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Erreur lors de la suppression du profil");
      return;
    }
    await refreshProfiles();
    toast.success("Profil supprimé");
    router.push("/profiles");
  };

  return (
    <div className="container mx-auto px-4 py-24 md:py-28">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar navigation */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/profiles")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour aux profils
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Édition du profil
              </h1>
              <p className="text-sm text-muted-foreground">
                {initialProfile.first_name}
              </p>
            </div>
            <nav className="flex flex-row lg:flex-col gap-1 flex-wrap">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Sections */}
        <div className="flex-1 space-y-8 max-w-2xl">
          {/* Section: Profil */}
          <Card id="infos" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  value={form.age}
                  onChange={handleChange}
                  min="1"
                  max="120"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly_pages_goal">
                  Objectif de lecture hebdo (pages)
                </Label>
                <Input
                  id="weekly_pages_goal"
                  name="weekly_pages_goal"
                  type="number"
                  min={0}
                  value={form.weekly_pages_goal}
                  onChange={handleChange}
                  placeholder="Ex. 50"
                />
                <p className="text-xs text-gray-500">
                  Laisse vide pour ne pas définir d&apos;objectif.
                </p>
              </div>
              <ImageUpload
                onUpload={setAvatarFilename}
                onUploadStateChange={setIsUploading}
                initialFilename={avatarFilename}
              />
            </CardContent>
          </Card>

          {/* Section: Apprentissage */}
          <Card id="apprentissage" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Niveaux & Conjugaison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProfileLevelsSelector
                profileId={initialProfile.id}
                onLevelsChange={setSelectedLevelIds}
              />
              <ConjugaisonSettings
                showRadical={showRadical}
                onShowRadicalChange={setShowRadical}
                groupes={groupes}
                onGroupesChange={setGroupes}
              />
            </CardContent>
          </Card>

          {/* Section: Livres */}
          <Card id="livres" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Livres</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileBooksManager profileId={initialProfile.id} />
            </CardContent>
          </Card>

          {/* Section: Suivi (To-Do) */}
          <Card id="suivi" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Suivi des To-Do quotidiens</CardTitle>
            </CardHeader>
            <CardContent>
              <TodoManager profileId={initialProfile.id} />
            </CardContent>
          </Card>

          {/* Save / Delete actions */}
          <div className="flex items-center justify-between pb-12">
            <Button variant="destructive" onClick={handleDelete}>
              <TrashIcon className="h-4 w-4 mr-2" />
              Supprimer le profil
            </Button>
            <Button onClick={handleSaveInfos} disabled={isSaving || isUploading}>
              {isSaving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
