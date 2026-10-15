"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api/client";
import { Lock, Mail, Loader2 } from "lucide-react";
import logo from "../../../public/favicon.svg";
import Image from "next/image";

const DEMO_PASSWORD = "Samvaad@123";
const DEMO_ACCOUNTS = [
  { role: "Super Admin",    name: "Dr. Kevin Carter", email: "kevin.carter@samvaadhospital.in" },
  { role: "Doctor",         name: "Dr. Sophia Adams", email: "sophia.adams@samvaadhospital.in" },
  { role: "Receptionist",   name: "Deepak Nair",      email: "deepak.nair@samvaadhospital.in" },
  { role: "Head Nurse",     name: "Rekha Menon",      email: "rekha.menon@samvaadhospital.in" },
  { role: "Pharmacist",     name: "Arun Tiwari",      email: "arun.tiwari@samvaadhospital.in" },
  { role: "Lab Technician", name: "Sunita Rao",       email: "sunita.rao@samvaadhospital.in" },
  { role: "Billing Exec",   name: "Kavitha Krishnan", email: "kavitha.krishnan@samvaadhospital.in" },
  { role: "IT Admin",       name: "Rahul Saxena",     email: "rahul.saxena@samvaadhospital.in" },
  { role: "Driver",         name: "Vijay Kumar",      email: "vijay.kumar@samvaadhospital.in" },
  { role: "Radiology Partner", name: "Scanwell Diagnostics", email: "reports@scanwell.in" },
  { role: "Super Admin (Sunrise Hospital)", name: "Sunrise Admin", email: "admin@sunrisehospital.in" },
  { role: "Platform Admin", name: "Platform Operations", email: "platform-admin@samvaad.dev" },
  { role: "Radiology Center (Apex Radiology)", name: "Apex Radiology Network", email: "admin@apexradiology.in" },
  { role: "Lab Center (Pathcare Diagnostics)", name: "Pathcare Diagnostics", email: "admin@pathcarediagnostics.in" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("kevin.carter@samvaadhospital.in");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await login(email, password);
      // Partner centres have single-resource access — land them on their worklist.
      const fallback =
        me.role === "Radiology Partner" ? "/radiology" :
        me.role === "Lab Partner" ? "/lab" :
        "/home";
      router.replace(params.get("next") || fallback);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Unable to sign in",
      );
      setLoading(false);
    }
  }

  /** Fill the form with a demo account; the user then hits Sign in. */
  function selectDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  const selectedRole = DEMO_ACCOUNTS.find(a => a.email === email)?.role ?? null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--canvas)] px-4">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex items-center gap-[10px] justify-center mb-8">
          <div className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center">
            {/* <span className="text-white text-[16px] font-medium">S</span> */}
            <Image width={28} height={28} className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0" src={logo} alt="header logo" />
          </div>
          <span className="text-[22px] font-medium text-[color:var(--ink)]">
            Samvaad <span className="text-[color:var(--brand)]">HMS</span>
          </span>
        </div>

        <div className="bg-[color:var(--surface)] rounded-[18px] border border-[color:var(--line)] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h1 className="text-[22px] font-medium text-[color:var(--ink)] mb-1">Welcome back</h1>
          <p className="text-[13px] font-light text-[color:var(--ink-soft)] mb-6">
            Sign in to your hospital management account.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-[7px]">
              <label className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[44px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[38px] pr-[14px] text-[14px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors"
                  placeholder="you@hospital.in"
                />
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <label className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[44px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[38px] pr-[14px] text-[14px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors"
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
              className="h-[44px] mt-1 bg-[color:var(--brand)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[color:var(--brand-hover)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[color:var(--subtle-2)]">
            <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">
              Demo roles — pick one, then sign in
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => {
                const selected = selectedRole === a.role;
                return (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => selectDemo(a)}
                    disabled={loading}
                    title={`${a.name} · ${a.email}`}
                    className={`px-3 py-[7px] rounded-full border text-[12px] font-normal transition-colors disabled:opacity-50 whitespace-nowrap ${
                      selected
                        ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                        : "border-[color:var(--line)] text-[color:var(--ink)] hover:border-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
                    }`}
                  >
                    {a.role}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-light text-[color:var(--ink-soft)] leading-5 mt-3">
              {selectedRole ? (
                <>Credentials filled for <span className="font-medium text-[color:var(--ink)]">{selectedRole}</span> — press Sign in.</>
              ) : (
                <>Selecting a role fills its credentials (shared password{" "}
                <span className="font-medium text-[color:var(--ink)]">{DEMO_PASSWORD}</span>).</>
              )}
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
