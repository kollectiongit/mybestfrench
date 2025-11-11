"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

async function validateSessionAndProfile(profileId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const profile = await prisma.profiles.findFirst({
    where: {
      id: profileId,
      user_id: session.user.id,
    },
  });

  if (!profile) {
    throw new Error("Profile not found");
  }
}

async function revalidateDictationPaths(dictationId: number) {
  revalidatePath("/exercices/dictees");
  revalidatePath(`/exercices/dictees/${dictationId}`);
}

export async function addFavoriteDictation(dictationId: number, profileId: string) {
  if (!dictationId || !profileId) {
    throw new Error("Missing required parameters");
  }

  await validateSessionAndProfile(profileId);

  await prisma.favorite_dictations_profiles.upsert({
    where: {
      profile_id_dictation_id: {
        profile_id: profileId,
        dictation_id: dictationId,
      },
    },
    update: {},
    create: {
      profile_id: profileId,
      dictation_id: dictationId,
    },
  });

  await revalidateDictationPaths(dictationId);

  return { success: true };
}

export async function removeFavoriteDictation(dictationId: number, profileId: string) {
  if (!dictationId || !profileId) {
    throw new Error("Missing required parameters");
  }

  await validateSessionAndProfile(profileId);

  await prisma.favorite_dictations_profiles.deleteMany({
    where: {
      profile_id: profileId,
      dictation_id: dictationId,
    },
  });

  await revalidateDictationPaths(dictationId);

  return { success: true };
}

