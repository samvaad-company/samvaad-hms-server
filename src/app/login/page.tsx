"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api/client";
import { Lock, Mail, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("kevin.carter@samvaadhospital.in");
  const [password, setPassword] = useState("Samvaad@123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const next = params.get("next") || "/patients";
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Unable to sign in",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7] px-4">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex items-center gap-[10px] justify-center mb-8">
          <div className="w-[36px] h-[36px] rounded-[10px] bg-[#009598] flex items-center justify-center">
            <span className="text-white text-[16px] font-medium">S</span>
          </div>
          <span className="text-[22px] font-medium text-[#11111c]">
            Samvaad <span className="text-[#009598]">HMS</span>
          </span>
        </div>

        <div className="bg-white rounded-[18px] border border-[#dedee1] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h1 className="text-[22px] font-medium text-[#11111c] mb-1">Welcome back</h1>
          <p className="text-[13px] font-light text-[#57575f] mb-6">
            Sign in to your hospital management account.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-[7px]">
              <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#57575f]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[44px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] pl-[38px] pr-[14px] text-[14px] text-[#11111c] focus:outline-none focus:border-[#009598] focus:bg-white transition-colors"
                  placeholder="you@hospital.in"
                />
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#57575f]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[44px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] pl-[38px] pr-[14px] text-[14px] text-[#11111c] focus:outline-none focus:border-[#009598] focus:bg-white transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-[44px] mt-1 bg-[#009598] text-white rounded-[8px] text-[14px] font-medium hover:bg-[#007f82] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#f0f0f0]">
            <p className="text-[11px] font-light text-[#57575f] leading-5">
              Demo account is pre-filled. All seeded users share the password{" "}
              <span className="font-medium text-[#11111c]">Samvaad@123</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
