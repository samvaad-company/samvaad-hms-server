"use client";

import { useEffect, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export interface DisplayMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
}

interface ChatMessageListProps {
  messages: DisplayMessage[];
  /** Text streaming in for the in-flight assistant reply, if any. */
  streamingText?: string;
  /** Domain currently being looked up (e.g. "patients"), if any. */
  toolStatus?: string | null;
  empty?: string;
}

export function ChatMessageList({ messages, streamingText, toolStatus, empty }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, toolStatus]);

  const showEmpty = messages.length === 0 && streamingText === undefined && !toolStatus;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {showEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <div className="w-10 h-10 rounded-full bg-[#e8f7f7] flex items-center justify-center">
            <Sparkles size={18} className="text-[#009598]" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-normal text-[#57575f]">
            {empty ?? "Ask anything about this hospital's data — patients, appointments, billing, lab, and more."}
          </p>
        </div>
      )}

      {messages.map((m) => (
        <Bubble key={m.id} role={m.role} content={m.content} sources={m.sources} />
      ))}

      {(streamingText !== undefined || toolStatus) && (
        <Bubble
          role="assistant"
          content={streamingText ?? ""}
          toolStatus={toolStatus}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function Bubble({
  role,
  content,
  sources,
  toolStatus,
}: {
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
  toolStatus?: string | null;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={
            isUser
              ? "bg-[#009598] text-white rounded-[14px] rounded-tr-[4px] px-3.5 py-2.5 text-[13px] font-normal leading-[19px] whitespace-pre-wrap break-words"
              : "bg-[#f6f6f6] text-[#11111c] rounded-[14px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] font-normal leading-[19px] whitespace-pre-wrap break-words"
          }
        >
          {content || (toolStatus ? "" : " ")}
          {toolStatus && (
            <span className="flex items-center gap-[6px] text-[#57575f]">
              <Loader2 size={12} className="animate-spin" />
              Looking up {toolStatus}…
            </span>
          )}
        </div>
        {!isUser && sources && sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-1">
            <span className="text-[10px] font-normal text-[#57575f]">Used:</span>
            {sources.map((s) => (
              <span
                key={s}
                className="text-[10px] font-normal text-[#57575f] bg-[#f2f3f3] rounded-[6px] px-[6px] py-[2px] capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
