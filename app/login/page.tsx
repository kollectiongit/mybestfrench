import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Connexion | Révisions",
  description: "Connectez-vous à votre compte Révisions",
};

export default async function Page() {
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
          <h1 className="text-3xl font-bold text-gray-900">Se connecter</h1>
          <p className="mt-2 text-sm text-gray-600">
            Crée ton compte pour commencer
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
