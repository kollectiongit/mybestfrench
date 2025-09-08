import type { Metadata } from "next";
import ResetPasswordPageClient from "./reset-password-page-client";

export const metadata: Metadata = {
  title: "Définir un nouveau mot de passe | My Best French",
  description: "Définis un nouveau mot de passe pour accéder à My Best French",
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
