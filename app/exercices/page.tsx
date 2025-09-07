"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ExercicesPage() {
  const { profile, isLoading } = useCurrentProfile();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we're not loading and we're sure there's no profile
    // Add a small delay to ensure profile context has time to load
    if (!isLoading && profile === null) {
      // Give the profile context more time to load
      const timer = setTimeout(() => {
        if (!isLoading && profile === null) {
          router.push("/profiles?message=profile-required");
        }
      }, 500); // Wait 500ms for profile to load

      return () => clearTimeout(timer);
    }
  }, [profile, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Exercices</h1>
        <p className="text-gray-600">
          Choisis un type d&apos;exercice pour t&apos;entrainer
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dictées</h2>
          <p className="text-gray-600 mb-4">
            Améliore ton orthographe avec des dictées adaptées à ton niveau
          </p>
          <button
            onClick={() => router.push("/exercices/dictees")}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Commencer les dictées
          </button>
        </div>

        {/* Add more exercise types here as needed */}
      </div>
    </div>
  );
}
