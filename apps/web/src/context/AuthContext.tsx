"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, getCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { organizationName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default fallback synthetic user for preview when offline
const DEMO_FALLBACK_USER: User = {
  id: "usr-demo-analyst",
  organizationId: "org-verdix-demo",
  name: "Demo Analyst",
  email: "analyst@verdix.demo",
  role: "ANALYST",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function initAuth() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
        } else {
          // Check if session token exists or fallback to demo session
          const token = typeof window !== "undefined" ? sessionStorage.getItem("verdix_auth_token") : null;
          if (token) {
            setCurrentUser(DEMO_FALLBACK_USER);
          }
        }
      } catch (err) {
        console.error("Failed to load user session:", err);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user } = await loginUser(email, password);
      setCurrentUser(user);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { organizationName: string; name: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { user } = await registerUser(data);
      setCurrentUser(user);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setCurrentUser(null);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
