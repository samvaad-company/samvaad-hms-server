"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tw } from "@/lib/design-system";

const SUGGESTIONS = ["Today's appointments", "Pending bills", "Patients admitted now", "Low stock items"];

/**
 * "Ask AI" box for the top of every role's home screen: type a question, or tap a suggestion, and it opens in AI Chat.
 * Shown to anyone who has the AI assistant.
 */
export function AskAiCard({ gutter = true }: { gutter?: boolean }) {
  const { can } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  if (!can("chat")) return null;

  const ask = (q: string) => {
    const t = q.trim();
    router.push(t ? `/chat?ask=${encodeURIComponent(t)}` : "/chat");
  };

  return (
    <div className={`${gutter ? `${tw.gutterX} mb-5` : ""}`}>
      <div className={`${tw.surface.card} ${tw.radius.card} p-3 sm:p-4 flex flex-col gap-3`}>
        <form
          onSubmit={(e) => { e.preventDefault(); ask(text); }}
          className="flex items-center gap-2 rounded-full bg-[color:var(--subtle)] pl-3 pr-1 h-[44px] focus-within:ring-1 focus-within:ring-[color:var(--brand)]"
        >
          <Sparkles size={16} className="text-[color:var(--brand)] shrink-0" strokeWidth={1.5} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask AI about patients, bills, reports, appointments…"
            aria-label="Ask AI"
            className="flex-1 min-w-0 bg-transparent text-[14px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-70 focus:outline-none"
          />
          <button type="submit" aria-label="Ask" className="w-9 h-9 shrink-0 rounded-full bg-[color:var(--brand)] flex items-center justify-center hover:bg-[color:var(--brand-hover)] cursor-pointer">
            <ArrowUp size={16} className="text-white" strokeWidth={2} />
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="text-[12px] rounded-full border border-[color:var(--line)] px-3 py-[5px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
