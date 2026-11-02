"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Sparkles, X, Plus, Maximize2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIsCompact } from "@/lib/use-media-query";
import { useChatThread } from "@/lib/api/useChatThread";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";

const BUTTON = 56;
const EDGE = 12;
const POS_KEY = "hms-ai-button";

export function ChatWidget() {
  const { user, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  // Phones and tablets: the launcher floats free. Drag it anywhere; it settles against the nearer side and remembers where.
  const compact = useIsCompact();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { x: number; y: number } | null;
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") setPos(saved);
    } catch { /* storage unavailable: use the default corner */ }
  }, []);

  // Keep the button on screen when the window changes size or turns.
  useEffect(() => {
    const keep = () => setPos((p) => (p ? { x: Math.min(p.x, window.innerWidth - BUTTON - EDGE), y: Math.min(p.y, window.innerHeight - BUTTON - EDGE) } : p));
    window.addEventListener("resize", keep);
    return () => window.removeEventListener("resize", keep);
  }, []);

  function onDragStart(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!compact) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDragMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    setPos({
      x: Math.max(EDGE, Math.min(window.innerWidth - BUTTON - EDGE, e.clientX - d.dx)),
      y: Math.max(EDGE + 52, Math.min(window.innerHeight - BUTTON - EDGE, e.clientY - d.dy)),
    });
  }
  function onDragEnd() {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    justDragged.current = true;
    setPos((p) => {
      if (!p) return p;
      const snapped = { x: p.x + BUTTON / 2 < window.innerWidth / 2 ? EDGE : window.innerWidth - BUTTON - EDGE, y: p.y };
      try { localStorage.setItem(POS_KEY, JSON.stringify(snapped)); } catch { /* not saved */ }
      return snapped;
    });
  }
  function onLauncherClick() {
    if (justDragged.current) { justDragged.current = false; return; }
    openWidget();
  }
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
        <div className="fixed z-50 bg-[color:var(--surface)] rounded-[18px] shadow-2xl border border-[color:var(--line)] flex flex-col overflow-hidden max-lg:inset-x-2 max-lg:bottom-2 max-lg:top-[60px] lg:bottom-24 lg:right-6 lg:w-[380px] lg:h-[560px]">
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
          data-tour="ai-launcher"
          onClick={onLauncherClick}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          aria-label="Open AI assistant"
          style={compact && pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", touchAction: "none" } : compact ? { touchAction: "none" } : undefined}
          className={`fixed bottom-5 right-4 lg:bottom-6 lg:right-6 z-50 w-14 h-14 rounded-full bg-[color:var(--brand)] shadow-[0_6px_20px_rgba(0,0,0,0.28)] ring-4 ring-white/70 dark:ring-black/40 flex items-center justify-center hover:bg-[color:var(--brand-hover)] select-none ${drag.current?.moved ? "" : "transition-[left,top,transform] duration-200"} active:scale-95`}
        >
          <Sparkles size={22} className="text-white" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
