"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, Mail, User, Building2, ArrowRight, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ organizationName, name, email, password });
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Registration failed. Please check your information.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col justify-center items-center p-4 antialiased text-[#0F172A]">
      {/* Brand Header */}
      <div className="mb-8 text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#071426] text-teal-400 shadow-md mb-2">
          <ShieldCheck className="w-7 h-7 text-teal-400" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
          VERDIX
        </h1>
        <p className="text-xs text-[#64748B] max-w-sm">
          Privacy-Preserving Data Evaluation Infrastructure
          <br />
          <span className="font-medium text-slate-700">Set up your secure organization enclave</span>
        </p>
      </div>

      {/* Registration Card */}
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
            Register Organization
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Create an independent organization workspace. The first user receives the ADMIN role.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Organization Name</span>
            </label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Financial Technologies"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all font-sans text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all font-sans text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Work Email</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acmefinancial.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all font-sans text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Password (min. 8 characters)</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all font-sans text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <span>Creating Enclave Workspace...</span>
            ) : (
              <>
                <span>Register Organization</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-[#64748B] pt-2 border-t border-[#F1F5F9]">
          Already registered?{" "}
          <Link href="/login" className="text-teal-600 hover:text-teal-700 font-semibold">
            Sign in to existing enclave
          </Link>
        </div>
      </div>
    </div>
  );
}
