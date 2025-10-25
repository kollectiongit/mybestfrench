import { revalidateTag } from "next/cache";

/**
 * Revalidate dictation-related cache entries
 */
export async function revalidateDictationCache(dictationId?: number, profileId?: string) {
  // Revalidate general dictations cache
  revalidateTag('dictations');
  
  if (profileId) {
    // Revalidate profile-specific cache
    revalidateTag(`profile-${profileId}`);
  }
  
  if (dictationId) {
    // Revalidate specific dictation cache
    revalidateTag(`dictation-${dictationId}`);
  }
}

/**
 * Revalidate cache when a new dictation is uploaded
 */
export async function revalidateOnDictationUpload() {
  revalidateTag('dictations');
}

/**
 * Revalidate cache when an attempt is completed
 */
export async function revalidateOnAttemptComplete(dictationId: number, profileId: string) {
  revalidateTag(`dictation-${dictationId}`);
  revalidateTag(`profile-${profileId}`);
}
