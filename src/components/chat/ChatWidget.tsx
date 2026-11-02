"use client";

/**
 * The AI assistant as a side drawer: full height on the right, open or closed from the AI button in the top bar,
 * and it stays put as you move between screens (the shell mounts it once). On wide screens it sits beside the page
 * (the shell makes room for it); on phones and tablets it slides over the page.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Plus, Maximize2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useChatThread } from "@/lib/api/useChatThread";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { AiQuotaBar } from "@/components/chat/AiQuotaBar";

interface ChatWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatWidget({ open, onOpenChange }: ChatWidgetProps) {
  const { user, can } = useAuth();
  const [input, setInput] = useState("");
  const { threadId, messages, loadingThread, streaming, streamText, toolStatus, quota, refreshQuota, ensureThread, newThread, send } =
    useChatThread();

  // Opening the drawer loads the latest chat and the person's token allowance.
  useEffect(() => {
    if (!open) return;
    void ensureThread();
    void refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes it.
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onOpenChange]);

  function handleSend() {
    const text = input;
    setInput("");
    void send(text);
  }

  if (!user || !can("chat")) return null;

  return (
    <>
      {/* Phones and tablets: dim the page behind the drawer. */}
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className={`lg:hidden fixed inset-0 z-[55] bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      <aside
        aria-label="AI assistant"
        aria-hidden={!open}
        className={`fixed top-0 right-0 bottom-0 z-[58] w-full sm:w-[420px] lg:w-[400px] lg:z-50 bg-[color:var(--surface)] border-l border-[color:var(--line)] shadow-2xl lg:shadow-none flex flex-col overflow-hidden transition-[transform,visibility] duration-[220ms] ease-in-out ${
          open ? "translate-x-0 visible" : "translate-x-full invisible"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-[52px] border-b border-[color:var(--line)] shrink-0 bg-[color:var(--chrome)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[color:var(--brand-soft)] flex items-center justify-center">
              <Sparkles size={14} className="text-[color:var(--brand)]" strokeWidth={1.5} />
            </div>
            <span className="text-[14px] font-medium text-[color:var(--ink)]">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void newThread()}
              title="New chat"
              aria-label="New chat"
              className="w-8 h-8 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors cursor-pointer"
            >
              <Plus size={16} />
            </button>
            <Link
              href={threadId != null ? `/chat?thread=${threadId}` : "/chat"}
              title="Open full view"
              aria-label="Open full view"
              className="w-8 h-8 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
            >
              <Maximize2 size={14} />
            </Link>
            <button
              onClick={() => onOpenChange(false)}
              title="Close"
              aria-label="Close AI assistant"
              className="w-8 h-8 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loadingThread && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[color:var(--ink-soft)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <ChatMessageList messages={messages} streamingText={streamText} toolStatus={toolStatus} />
        )}

        <AiQuotaBar quota={quota} />
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={streaming || loadingThread || Boolean(quota?.exceeded)}
          placeholder={quota?.blocked ? "AI access paused" : quota?.exceeded ? "Monthly AI quota used up" : undefined}
        />
      </aside>
    </>
  );
}
