"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { authClient } from "../../../lib/auth-client";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      const { error } = await authClient.signUp.email(
        {
          email,
          password,
          name,
          callbackURL: "/profiles", // Redirect to profiles after email verification
        },
        {
          onRequest: () => {
            setIsLoading(true);
          },
          onSuccess: async () => {
            setIsLoading(false);

            // Send welcome email after successful signup
            try {
              const response = await fetch("/api/send-welcome-email", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: email,
                  name: name,
                }),
              });

              if (response.ok) {
                console.log("✅ Welcome email sent");
              } else {
                console.error("❌ Failed to send welcome email");
              }
            } catch (error) {
              console.error("❌ Error sending welcome email:", error);
            }

            // Redirect to profiles after successful signup
            window.location.href = "/profiles";
          },
          onError: (ctx) => {
            // Handle specific error cases
            if (
              ctx.error.message?.includes("already exists") ||
              ctx.error.message?.includes("existing email") ||
              ctx.error.message?.includes("duplicate")
            ) {
              setError("Il y a déjà un compte avec cet email");
            } else {
              setError(ctx.error.message ?? "Une erreur est survenue");
            }
            setIsLoading(false);
          },
        }
      );

      if (error) {
        // Handle specific error cases
        if (
          error.message?.includes("already exists") ||
          error.message?.includes("existing email") ||
          error.message?.includes("duplicate")
        ) {
          setError("Il y a déjà un compte avec cet email");
        } else {
          setError(error.message ?? "Une erreur est survenue");
        }
      }
    } catch {
      setError("Une erreur inattendue est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Le mot de passe doit contenir au moins 8 caractères
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Création du compte..." : "Créer le compte"}
                </Button>
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
            </div>
            <div className="mt-4 text-center text-sm">
              Tu as déjà un compte ?{" "}
              <a href="/login" className="underline underline-offset-4">
                Connecte-toi
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
