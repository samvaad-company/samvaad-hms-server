"use client";

/**
 * Shared chat-thread state machine — loading/creating a thread and sending a
 * message with a live streaming reply. Used by both the floating ChatWidget
 * and the dedicated /chat page so the send/stream logic exists exactly once.
 */
import { useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { sendChatMessage } from "@/lib/api/chat-stream";
import type { ChatThreadDTO, ChatMessageDTO } from "@/types/api";
import type { DisplayMessage } from "@/components/chat/ChatMessageList";

function toolLabel(name: string): string {
  return name.replace(/^query_|^get_/, "").replace(/_/g, " ");
}

export function useChatThread() {
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState<string | undefined>(undefined);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  // Coalesces concurrent ensureThread() callers (e.g. the page's mount
  // effect and a fast send() both racing to resolve "which thread is
  // active") onto one in-flight request instead of each independently
  // creating/selecting a thread.
  const ensureThreadPromise = useRef<Promise<number> | null>(null);

  async function loadThread(id: number) {
    setLoadingThread(true);
    try {
      const data = await api.get<{ thread: ChatThreadDTO; messages: ChatMessageDTO[] }>(`/chat/threads/${id}`);
      setThreadId(data.thread.id);
      setMessages(data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources })));
    } finally {
      setLoadingThread(false);
    }
  }

  async function newThread(): Promise<number> {
    setLoadingThread(true);
    try {
      const created = await api.post<ChatThreadDTO>("/chat/threads", {});
      setThreadId(created.id);
      setMessages([]);
      return created.id;
    } finally {
      setLoadingThread(false);
    }
  }

  /** Loads the most recent thread, or creates one if none exist yet. */
  function ensureThread(): Promise<number> {
    if (threadId !== null) return Promise.resolve(threadId);
    if (ensureThreadPromise.current) return ensureThreadPromise.current;

    const promise = (async () => {
      setLoadingThread(true);
      try {
        const { data: threads } = await api.list<ChatThreadDTO>("/chat/threads");
        if (threads.length > 0) {
          await loadThread(threads[0].id);
          return threads[0].id;
        }
        const created = await api.post<ChatThreadDTO>("/chat/threads", {});
        setThreadId(created.id);
        setMessages([]);
        return created.id;
      } finally {
        setLoadingThread(false);
        ensureThreadPromise.current = null;
      }
    })();
    ensureThreadPromise.current = promise;
    return promise;
  }

  async function send(text: string, onSent?: () => void) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const id = threadId ?? (await ensureThread());

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    setStreaming(true);
    setStreamText("");
    setToolStatus(null);

    let acc = "";
    const usedSources = new Set<string>();

    await sendChatMessage(id, trimmed, {
      onTool: (name) => {
        const label = toolLabel(name);
        usedSources.add(label);
        setToolStatus(label);
      },
      onTextDelta: (delta) => {
        acc += delta;
        setToolStatus(null);
        setStreamText(acc);
      },
      onDone: (messageId) => {
        setMessages((prev) => [
          ...prev,
          { id: messageId, role: "assistant", content: acc, sources: usedSources.size ? Array.from(usedSources) : null },
        ]);
        setStreamText(undefined);
        setToolStatus(null);
      },
      onError: (message) => {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", content: `Sorry, something went wrong: ${message}` },
        ]);
        setStreamText(undefined);
        setToolStatus(null);
      },
    });
    setStreaming(false);
    onSent?.();
  }

  return {
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
  };
}
