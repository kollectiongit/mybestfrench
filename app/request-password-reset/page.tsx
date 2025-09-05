import { RequestPasswordResetForm } from "@/components/login/request-password-reset-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réinitialisation du mot de passe | Révisions",
  description:
    "Demandez un lien de réinitialisation de votre mot de passe Révisions",
};

export default function RequestPasswordResetPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Nouveau mot de passe
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Entre ton email pour recevoir un lien de réinitialisation du mot de
            passe
          </p>
        </div>
        <RequestPasswordResetForm />
      </div>
    </div>
  );
}
