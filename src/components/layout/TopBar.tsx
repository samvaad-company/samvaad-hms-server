"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Settings, Bell, LogOut, ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumbValue } from "@/lib/breadcrumb-context";
import { api } from "@/lib/api/client";
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
    <div className="relative" ref={ref}>
      <div
        className={`bg-white rounded-full flex items-center shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-200 ${
          open ? "gap-2 pl-3 pr-2 py-[5px]" : "p-[6px]"
        }`}
      >
        {open ? (
          <>
            <Search size={16} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients, doctors, appointments…"
              className="w-[260px] bg-transparent text-[13px] text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none"
            />
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[#57575f] shrink-0" />
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  setHits([]);
                }}
                className="text-[#57575f] hover:text-[#11111c] text-[16px] leading-none px-1"
              >
                ×
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="flex items-center justify-center cursor-pointer"
          >
            <Search size={18} strokeWidth={1.5} className="text-[#11111c]" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-[42px] z-50 w-[340px] bg-white rounded-[12px] border border-[#dedee1] shadow-lg py-1 max-h-[380px] overflow-y-auto">
          {hits.length === 0 && !loading ? (
            <div className="px-4 py-3 text-[13px] text-[#57575f]">No results for “{query.trim()}”.</div>
          ) : (
            groups.map((g) => (
              <div key={g}>
                <div className="px-4 pt-2 pb-1 text-[10px] font-medium text-[#57575f] uppercase tracking-wider">{g}</div>
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
                      className="w-full text-left px-4 py-[7px] hover:bg-[#f6f6f6] transition-colors"
                    >
                      <span className="block text-[13px] text-[#11111c] truncate">{h.label}</span>
                      <span className="block text-[11px] text-[#57575f] truncate">{h.hint}</span>
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

export function TopBar({ sidebarLeft }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const crumb = useBreadcrumbValue();

  return (
    <div
      className="fixed top-0 z-40 h-[52px] bg-[#f7f7f7] flex items-center justify-between px-6 gap-4"
      style={{ left: sidebarLeft, right: 0, borderBottom: "1px solid #dedee1", transition: "left 220ms ease" }}
    >
      {/* Breadcrumb (published by the current page) */}
      <div className="flex items-center gap-2 min-w-0">
        {crumb && (
          <>
            <Link
              href={crumb.href}
              className="flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors whitespace-nowrap"
            >
              <ChevronLeft size={15} /> {crumb.label}
            </Link>
            {crumb.title && (
              <>
                <span className="text-[#dedee1]">/</span>
                <span className="text-[13px] font-medium text-[#11111c] truncate">{crumb.title}</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <GlobalSearch />

        {/* Settings + Bell */}
        <div className="bg-white rounded-full flex items-center gap-[10px] px-[10px] py-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <Settings size={18} strokeWidth={1.5} className="text-[#11111c] cursor-pointer" />
          <div className="w-px h-[14px] bg-[#dedee1]" />
          <Bell size={18} strokeWidth={1.5} className="text-[#11111c] cursor-pointer" />
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-[8px] cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#b8d9d9] flex items-center justify-center shrink-0">
              <span className="text-[12px] font-medium text-[#009598]">
                {user ? initials(user.name) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[13px] font-medium text-[#11111c] leading-[15px] whitespace-nowrap">
                {user?.name ?? "Loading…"}
              </span>
              <span className="text-[11px] font-light text-[#57575f] leading-[13px]">
                {user?.role ?? ""}
              </span>
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-[40px] z-50 w-[200px] bg-white rounded-[12px] border border-[#dedee1] shadow-lg py-2">
                <div className="px-4 py-2 border-b border-[#f0f0f0]">
                  <p className="text-[13px] font-medium text-[#11111c] truncate">{user?.name}</p>
                  <p className="text-[11px] font-light text-[#57575f] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors"
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
}
