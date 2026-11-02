"use client";

/**
 * The AI assistant as a side drawer: full height on the right, open or closed from the AI button in the top bar,
 * and it stays put as you move between screens (the shell mounts it once). On wide screens it sits beside the page
 * (the shell makes room for it); on phones and tablets it slides over the page, and a draggable round button floats
 * on screen to open it.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Sparkles, X, Plus, Maximize2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIsCompact } from "@/lib/use-media-query";
import { useChatThread } from "@/lib/api/useChatThread";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { AiQuotaBar } from "@/components/chat/AiQuotaBar";

const BUTTON = 56;
const EDGE = 12;
const POS_KEY = "hms-ai-button";

interface ChatWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatWidget({ open, onOpenChange }: ChatWidgetProps) {
  const { user, can } = useAuth();
  const [input, setInput] = useState("");
  // Phones and tablets: the launcher floats free. Drag it anywhere; it settles against the nearer side and remembers where.
  const compact = useIsCompact();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const { threadId, messages, loadingThread, streaming, streamText, toolStatus, quota, refreshQuota, ensureThread, newThread, send } =
    useChatThread();

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

  function onDragStart(e: ReactPointerEvent<HTMLButtonElement>) {
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
    onOpenChange(true);
  }

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

      {/* Phones and tablets: a draggable round button floats on screen while the drawer is closed. */}
      {compact && !open && (
        <button
          onClick={onLauncherClick}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          aria-label="Open AI assistant"
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", touchAction: "none" } : { touchAction: "none" }}
          className={`fixed bottom-5 right-4 z-50 w-14 h-14 rounded-full bg-[color:var(--brand)] shadow-[0_6px_20px_rgba(0,0,0,0.28)] ring-4 ring-white/70 dark:ring-black/40 flex items-center justify-center hover:bg-[color:var(--brand-hover)] select-none ${drag.current?.moved ? "" : "transition-[left,top,transform] duration-200"} active:scale-95`}
        >
          <Sparkles size={22} className="text-white" strokeWidth={1.5} />
        </button>
      )}
    </>
  );
}
