"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  FileBarChart2,
  Shield,
  History,
  Settings,
  ShieldCheck,
  Signal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_AGENT_STATUS } from "@/lib/mock-data";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Evaluations",
      href: "/evaluations",
      icon: FileSpreadsheet,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: FileBarChart2,
    },
    {
      name: "Privacy Monitor",
      href: "/privacy",
      icon: Shield,
    },
    {
      name: "Audit Log",
      href: "/audit",
      icon: History,
    },
  ];

  return (
    <aside className="w-64 flex flex-col h-full bg-[#071426] border-r border-[#152844] select-none text-slate-300">
      {/* Brand Header */}
      <div className="pt-6 pb-4 px-6">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="h-9 w-9 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-400 group-hover:border-teal-400 transition-colors shadow-sm">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              VERDIX
            </div>
          </div>
        </Link>

        {/* Brand Tagline */}
        <div className="mt-3 text-[11px] leading-relaxed text-slate-400 font-normal">
          Don&apos;t share your data.
          <br />
          <span className="text-slate-300">Share the insight.</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/dashboard" && (pathname === "/" || pathname === "/dashboard"));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-[#142644] text-white font-semibold shadow-sm border border-[#203960]"
                  : "text-slate-400 hover:text-slate-100 hover:bg-[#0E1E36]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-teal-400" : "text-slate-400 group-hover:text-slate-200"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Area: Agent Status & Settings */}
      <div className="p-4 border-t border-[#152844] space-y-3 bg-[#050E1B]">
        {/* Agent Connected Card */}
        <div className="p-3 rounded-lg bg-[#0C1B30] border border-[#183155] space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">Agent Connected</span>
          </div>

          <div className="space-y-0.5 text-[11px]">
            <div className="text-slate-300 font-medium truncate">
              {MOCK_AGENT_STATUS.name}
            </div>
            <div className="text-slate-500 font-mono text-[10px]">
              ID: {MOCK_AGENT_STATUS.enclaveId}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-teal-400 font-mono pt-1 border-t border-[#152B4B]">
            <Signal className="w-3 h-3 text-teal-400" />
            <span>{MOCK_AGENT_STATUS.latencyMs}ms latency</span>
          </div>
        </div>

        {/* Settings button */}
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#0E1E36] transition-colors w-full"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
