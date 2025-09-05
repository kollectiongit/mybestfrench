import { ResetPasswordForm } from "@/components/login/reset-password-form";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Nouveau mot de passe | Révisions",
  description: "Réinitialisez votre mot de passe Révisions",
};

export default async function ResetPasswordPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
