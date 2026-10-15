"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Plus, Maximize2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useChatThread } from "@/lib/api/useChatThread";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";

export function ChatWidget() {
  const { user, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { threadId, messages, loadingThread, streaming, streamText, toolStatus, ensureThread, newThread, send } =
    useChatThread();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function openWidget() {
    setOpen(true);
    void ensureThread();
  }

  function handleSend() {
    const text = input;
    setInput("");
    void send(text);
  }

  if (!user || !can("chat")) return null;

  return (
    <div ref={containerRef}>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[560px] bg-[color:var(--surface)] rounded-[18px] shadow-2xl border border-[color:var(--line)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--line)] shrink-0">
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
                className="w-7 h-7 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
              >
                <Plus size={16} />
              </button>
              <Link
                href={threadId != null ? `/chat?thread=${threadId}` : "/chat"}
                title="Open full view"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
              >
                <Maximize2 size={14} />
              </Link>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors"
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

          <ChatComposer value={input} onChange={setInput} onSend={handleSend} disabled={streaming || loadingThread} />
        </div>
      )}

      {!open && (
        <button
          onClick={openWidget}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[color:var(--brand)] shadow-lg flex items-center justify-center hover:bg-[color:var(--brand-hover)] transition-colors"
        >
          <Sparkles size={22} className="text-white" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
