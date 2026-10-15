"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Settings, Bell, LogOut, UserCog, ChevronLeft, Loader2, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumbValue } from "@/lib/breadcrumb-context";
import { api } from "@/lib/api/client";
import { useColorMode } from "@/lib/color-mode";
import { MyProfileModal } from "@/components/profile/MyProfileModal";
import type { PatientDTO, DoctorDTO, AppointmentDTO } from "@/types/api";

interface TopBarProps {
  sidebarLeft: number;
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface SearchHit {
  group: string;
  label: string;
  hint: string;
  href: string;
}

/** Expandable global search: patients, doctors, appointments. */
function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K opens the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setHits([]);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setHits([]);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  // Debounced cross-module search (all state updates deferred to the timer).
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setHits([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [patients, doctors, appts] = await Promise.all([
          api.list<PatientDTO>("/patients", { search: q, pageSize: 4 }),
          api.list<DoctorDTO>("/doctors", { search: q, pageSize: 4 }),
          api.list<AppointmentDTO>("/appointments", { search: q, pageSize: 4 }),
        ]);
        const next: SearchHit[] = [
          ...patients.data.map((p) => ({
            group: "Patients",
            label: p.name,
            hint: `${p.patientId ?? ""} · ${p.phone}`,
            href: `/patients/${p.id}`,
          })),
          ...doctors.data.map((d) => ({
            group: "Doctors",
            label: d.name,
            hint: d.specialty,
            href: `/doctors/${d.id}`,
          })),
          ...appts.data.map((a) => ({
            group: "Appointments",
            label: `${a.patientName} — ${a.doctor}`,
            hint: `${a.date} · ${a.time}`,
            href: `/appointments/${a.id}`,
          })),
        ];
        setHits(next);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const groups = Array.from(new Set(hits.map((h) => h.group)));

  return (
    <div className="relative w-[clamp(180px,32vw,440px)] shrink" ref={ref}>
      <div
        className={`bg-[color:var(--surface)] rounded-full flex items-center gap-2 pl-3 pr-2 h-[34px] border transition-colors ${
          open ? "border-[color:var(--brand)] shadow-[0_1px_6px_rgba(0,0,0,0.10)]" : "border-[color:var(--chrome-line)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        }`}
      >
        <Search size={16} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
        {open ? (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients, doctors, appointments…"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none"
            />
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[color:var(--ink-soft)] shrink-0" />
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  setHits([]);
                }}
                aria-label="Close search"
                className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] text-[16px] leading-none px-1 cursor-pointer"
              >
                ×
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <span className="text-[13px] text-[color:var(--ink-soft)] truncate">Search patients, doctors, appointments…</span>
            <span className="flex items-center gap-1 shrink-0">
              <kbd className="text-[10px] font-mono rounded-[4px] px-[5px] py-[1px] bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]">⌘</kbd>
              <kbd className="text-[10px] font-mono rounded-[4px] px-[5px] py-[1px] bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]">K</kbd>
            </span>
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-[42px] z-50 bg-[color:var(--surface)] rounded-[12px] border border-[color:var(--line)] shadow-lg py-1 max-h-[380px] overflow-y-auto">
          {hits.length === 0 && !loading ? (
            <div className="px-4 py-3 text-[13px] text-[color:var(--ink-soft)]">No results for “{query.trim()}”.</div>
          ) : (
            groups.map((g) => (
              <div key={g}>
                <div className="px-4 pt-2 pb-1 text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{g}</div>
                {hits
                  .filter((h) => h.group === g)
                  .map((h) => (
                    <button
                      key={h.href + h.label}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                        setHits([]);
                        router.push(h.href);
                      }}
                      className="w-full text-left px-4 py-[7px] hover:bg-[color:var(--subtle)] transition-colors"
                    >
                      <span className="block text-[13px] text-[color:var(--ink)] truncate">{h.label}</span>
                      <span className="block text-[11px] text-[color:var(--ink-soft)] truncate">{h.hint}</span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const TopBar = memo(function TopBar({ sidebarLeft }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { mode, toggle: toggleMode } = useColorMode();
  const crumb = useBreadcrumbValue();

  return (
    <div
      className="fixed top-0 z-40 h-[52px] bg-[color:var(--chrome)] flex items-center justify-between px-6 gap-4"
      style={{ left: sidebarLeft, right: 0, borderBottom: "1px solid var(--chrome-line)", transition: "left 220ms ease" }}
    >
      {/* Breadcrumb (published by the current page) */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {crumb && (
          <>
            <Link
              href={crumb.href}
              className="flex items-center gap-1 text-[13px] font-normal text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors whitespace-nowrap"
            >
              <ChevronLeft size={15} /> {crumb.label}
            </Link>
            {crumb.title && (
              <>
                <span className="text-[color:var(--line)]">/</span>
                <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{crumb.title}</span>
              </>
            )}
          </>
        )}
      </div>

      <MyProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <GlobalSearch />

      <div className="flex-1 flex items-center justify-end gap-3">

        {/* Settings · light/dark · notifications */}
        <div className="bg-[color:var(--surface)] rounded-full flex items-center gap-[10px] px-[10px] py-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <Link href="/settings" aria-label="Settings" title="Settings" className="text-[color:var(--ink)] hover:text-[color:var(--brand)] transition-colors">
            <Settings size={18} strokeWidth={1.5} />
          </Link>
          <div className="w-px h-[14px] bg-[color:var(--line)]" />
          <button type="button" onClick={toggleMode} aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="text-[color:var(--ink)] hover:text-[color:var(--brand)] transition-colors cursor-pointer">
            {mode === "dark" ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          <div className="w-px h-[14px] bg-[color:var(--line)]" />
          <Bell size={18} strokeWidth={1.5} className="text-[color:var(--ink)] cursor-pointer" />
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-[8px] cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[color:var(--brand-ring)] flex items-center justify-center shrink-0">
              <span className="text-[12px] font-medium text-[color:var(--brand)]">
                {user ? initials(user.name) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[13px] font-medium text-[color:var(--ink)] leading-[15px] whitespace-nowrap">
                {user?.name ?? "Loading…"}
              </span>
              <span className="text-[11px] font-light text-[color:var(--ink-soft)] leading-[13px]">
                {user?.role ?? ""}
              </span>
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-[40px] z-50 w-[200px] bg-[color:var(--surface)] rounded-[12px] border border-[color:var(--line)] shadow-lg py-2">
                <div className="px-4 py-2 border-b border-[color:var(--subtle-2)]">
                  <p className="text-[13px] font-medium text-[color:var(--ink)] truncate">{user?.name}</p>
                  <p className="text-[11px] font-light text-[color:var(--ink-soft)] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
                >
                  <UserCog size={16} strokeWidth={1.5} /> My profile
                </button>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.5} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
