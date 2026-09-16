"use client";

import React from "react";
import { Search, Bell, ShieldCheck, Menu } from "lucide-react";

interface TopBarProps {
  onToggleMobileMenu: () => void;
}

export function TopBar({ onToggleMobileMenu }: TopBarProps) {
  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white sticky top-0 z-30 px-6 sm:px-8 flex items-center justify-between shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {/* Left: Hamburger (mobile) + Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search datasets, evaluations, reports..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10 transition-all shadow-sm"
            readOnly
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-[#E2E8F0] shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Zero Raw-Data Guarantee, Notifications, Profile */}
      <div className="flex items-center gap-4">
        {/* Zero Raw-Data Guarantee Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Zero Raw-Data Guarantee</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* User Profile Area */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#E2E8F0]">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
            EA
          </div>
          <div className="hidden lg:block text-left text-xs leading-tight">
            <div className="font-semibold text-slate-900">Enclave Admin</div>
            <div className="text-[11px] text-slate-500">SecOps Team</div>
          </div>
        </div>
      </div>
    </header>
  );
}
