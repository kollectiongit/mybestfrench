"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "../../lib/auth-client";

export default function WelcomePage() {
  const { data: session, isPending } = authClient.useSession();

  const handleContinue = () => {
    window.location.href = "/dashboard";
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Not authenticated</h2>
          <p className="text-gray-600 mb-4">
            Please sign in to access this page.
          </p>
          <Button onClick={() => (window.location.href = "/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome! 🎉</CardTitle>
            <CardDescription>
              Your account has been created successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Welcome,{" "}
                <span className="font-semibold">
                  {session.user.name || session.user.email}
                </span>
                !
              </p>
              <p className="text-sm text-gray-500">
                Your account is now ready to use.
              </p>
            </div>

            <Button onClick={handleContinue} className="w-full">
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
