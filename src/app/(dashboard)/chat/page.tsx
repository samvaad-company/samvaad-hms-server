"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PageHeader } from "@/components/shared/PageHeader";
import { RowMenu } from "@/components/shared/RowMenu";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useList } from "@/lib/api/hooks";
import { useRowActions } from "@/lib/api/useRowActions";
import { useChatThread } from "@/lib/api/useChatThread";
import type { ChatThreadDTO } from "@/types/api";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const { items: threads, loading: threadsLoading, reload } = useList<ChatThreadDTO>("/chat/threads");
  const { dialog, remove } = useRowActions("chat/threads", reload);
  const {
    threadId,
    messages,
    loadingThread,
    streaming,
    streamText,
    toolStatus,
    loadThread,
    newThread,
    ensureThread,
    send,
  } = useChatThread();

  useEffect(() => {
    const requested = searchParams.get("thread");
    if (requested) {
      void loadThread(Number(requested));
    } else {
      void ensureThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewChat() {
    await newThread();
    reload();
  }

  function handleSend() {
    const text = input;
    setInput("");
    void send(text, reload);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 52px)" }}>
      {dialog}
      <div className="shrink-0">
        <PageHeader
          title="AI Chat"
          subtitle="Ask anything about this hospital's data — the answers are always scoped to what your role can see."
          stats={[]}
          action={{ label: "New Chat", icon: Plus, onClick: handleNewChat }}
        />
      </div>

      <div className={`${tw.gutterX} pb-[20px] flex gap-4 flex-1 min-h-0`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden flex flex-col`} style={{ width: 280 }}>
          <div className="px-4 py-3 border-b border-[#dedee1] shrink-0">
            <span className="text-[12px] font-medium text-[#57575f] uppercase tracking-wider">History</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threadsLoading && threads.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#57575f]">Loading…</div>
            ) : threads.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#57575f] px-4">No chats yet — start one below.</div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between gap-1 px-4 py-3 border-b border-[#f2f3f3] cursor-pointer transition-colors ${
                    t.id === threadId ? "bg-[#e8f7f7]" : "hover:bg-[#fafafa]"
                  }`}
                  onClick={() => void loadThread(t.id)}
                >
                  <div className="min-w-0">
                    <p className={`text-[13px] truncate ${t.id === threadId ? "font-medium text-[#009598]" : "font-normal text-[#11111c]"}`}>
                      {t.title || "New chat"}
                    </p>
                    <p className="text-[11px] font-light text-[#57575f]">{relativeTime(t.updatedAt)}</p>
                  </div>
                  <RowMenu
                    actions={[
                      { label: "Delete", danger: true, onClick: () => remove(t.id, t.title || "this chat") },
                    ]}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden flex flex-col flex-1`}>
          {loadingThread && messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#57575f]">
              <Sparkles size={20} className="animate-pulse text-[#009598]" strokeWidth={1.5} />
              <span className="text-[13px]">Loading…</span>
            </div>
          ) : (
            <ChatMessageList messages={messages} streamingText={streamText} toolStatus={toolStatus} />
          )}
          <ChatComposer value={input} onChange={setInput} onSend={handleSend} disabled={streaming || loadingThread} />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
