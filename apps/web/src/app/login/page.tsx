"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, KeyRound } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("analyst@verdix.demo");
  const [password, setPassword] = useState("DemoPassword123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Invalid credentials. Please check your email and password.");
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
          <span className="font-medium text-slate-700">Don&apos;t share your data. Share the insight.</span>
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
            Sign In to Enclave Console
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Enter your organization credentials to access evaluation metrics.
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
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Work Email</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@organization.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all font-sans text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Password</span>
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
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Callout */}
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <KeyRound className="w-3.5 h-3.5 text-teal-600" />
            <span>Development Demo Credentials</span>
          </div>
          <div className="text-[11px] text-[#64748B] font-mono space-y-0.5">
            <div>Email: <span className="text-slate-800 font-semibold">analyst@verdix.demo</span></div>
            <div>Pass:  <span className="text-slate-800 font-semibold">DemoPassword123!</span></div>
          </div>
        </div>

        <div className="text-center text-xs text-[#64748B] pt-2 border-t border-[#F1F5F9]">
          Don&apos;t have an organization account?{" "}
          <Link href="/register" className="text-teal-600 hover:text-teal-700 font-semibold">
            Register new enclave
          </Link>
        </div>
      </div>
    </div>
  );
}
