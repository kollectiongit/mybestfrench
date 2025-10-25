"use client";

import { createContext, ReactNode, useContext } from "react";

// Session type from BetterAuth - using any for now to match the actual auth.api.getSession return type
interface Session {
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    image: string | null | undefined;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null | undefined;
    userAgent: string | null | undefined;
  };
}

interface SessionContextType {
  session: Session | null;
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  session: unknown; // Using unknown to match BetterAuth's actual return type
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  const value: SessionContextType = {
    session: session as Session | null,
    isAuthenticated: !!session,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
