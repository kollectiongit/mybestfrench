import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import EditProfilePageClient from "./edit-profile-page-client";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const profile = await prisma.profiles.findFirst({
    where: { id, user_id: session.user.id },
    include: {
      profile_levels: {
        include: {
          levels: { select: { id: true, code: true, label: true, rank: true } },
        },
      },
    },
  });

  if (!profile) {
    redirect("/profiles");
  }

  const initialProfile = {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
    age: profile.age,
    description: profile.description,
    weekly_pages_goal: profile.weekly_pages_goal ?? null,
    conjugaison_show_radical: profile.conjugaison_show_radical ?? true,
    conjugaison_groupes: profile.conjugaison_groupes ?? [1, 2, 3],
  };

  return <EditProfilePageClient initialProfile={initialProfile} />;
}
