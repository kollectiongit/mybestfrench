"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPageClient() {
  const { profile, isLoading } = useCurrentProfile();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && profile) {
      router.push("/dashboard");
    }
  }, [profile, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center"></div>
        </div>
      </div>
    );
  }

  if (profile) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Nouveau mot de passe
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Entre ton nouveau mot de passe ci-dessous
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
