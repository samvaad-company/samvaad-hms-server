"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** A line of guidance under the title. */
  subtitle?: string;
}

export function Modal({ open, onClose, title, children, footer, width = 600, subtitle }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-[color:var(--surface)] rounded-[18px] shadow-2xl flex flex-col overflow-hidden"
        style={{ width, maxWidth: "100%", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--line)] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium text-[color:var(--ink)]">{title}</h2>
            {subtitle && <p className="mt-[2px] text-[13px] text-[color:var(--ink-soft)]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[color:var(--line)] flex items-center justify-end gap-3 shrink-0 bg-[color:var(--faint)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
