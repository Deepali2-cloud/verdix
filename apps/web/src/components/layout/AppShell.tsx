"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LineChart, Calendar, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showSubheaderControls?: boolean;
}

export function AppShell({
  title,
  subtitle,
  children,
  showSubheaderControls = true,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center text-xs font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span>Verifying enclave credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#0F172A] flex antialiased">
      {/* Desktop Sidebar (Fixed Left, Dark Navy) */}
      <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0 z-40">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Layout (Light Workspace) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F5F7FB]">
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />

        {/* Dashboard Subheader matching the reference image */}
        <div className="px-6 sm:px-8 pt-7 pb-2 max-w-[1400px] w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-sm">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {showSubheaderControls && (
            <div className="flex items-center gap-4 text-xs">
              {/* Date Filter Dropdown */}
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Last 30 days</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Updated time indicator */}
              <div className="flex items-center gap-1.5 text-[#64748B] font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Updated 5 min ago</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Viewport */}
        <main className="flex-1 px-6 sm:px-8 py-6 max-w-[1400px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
