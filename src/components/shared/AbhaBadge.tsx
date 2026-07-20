"use client";

/**
 * Displays a patient's government ABHA (Ayushman Bharat Health Account) number.
 * Formats the 14-digit ID as xx-xxxx-xxxx-xxxx and shows a verified state, or a
 * muted "not linked" prompt when the patient has no ABHA on file.
 */
import { ShieldCheck, ShieldAlert } from "lucide-react";

export function formatAbha(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
  }
  return raw;
}

interface AbhaBadgeProps {
  abhaId?: string | null;
  /** "card" renders a full labelled block; "inline" a compact chip. */
  variant?: "card" | "inline";
  className?: string;
}

export function AbhaBadge({ abhaId, variant = "inline", className = "" }: AbhaBadgeProps) {
  const linked = Boolean(abhaId && abhaId.trim());

  if (variant === "card") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div
          className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
            linked ? "bg-[#e8f7f7]" : "bg-[#f2f3f3]"
          }`}
        >
          {linked ? (
            <ShieldCheck size={16} className="text-[#009598]" strokeWidth={1.75} />
          ) : (
            <ShieldAlert size={16} className="text-[#57575f]" strokeWidth={1.75} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-normal text-[#57575f] uppercase tracking-wider">
            ABHA ID
          </p>
          {linked ? (
            <p className="text-[13px] font-medium text-[#11111c] tabular-nums truncate">
              {formatAbha(abhaId!)}
            </p>
          ) : (
            <p className="text-[13px] font-light text-[#57575f]">Not linked</p>
          )}
        </div>
      </div>
    );
  }

  if (!linked) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full text-[11px] font-normal bg-[#f2f3f3] text-[#57575f] ${className}`}
      >
        <ShieldAlert size={12} strokeWidth={1.75} /> No ABHA
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full text-[11px] font-medium bg-[#e8f7f7] text-[#009598] tabular-nums ${className}`}
      title="ABHA linked"
    >
      <ShieldCheck size={12} strokeWidth={1.75} /> {formatAbha(abhaId!)}
    </span>
  );
}
