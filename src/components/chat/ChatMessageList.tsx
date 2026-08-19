"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, Loader2, UserRound } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface DisplayMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
  /** The patient this reply resolved to, if any — renders a "View patient" link. */
  patientId?: number | null;
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
        <Bubble key={m.id} role={m.role} content={m.content} sources={m.sources} patientId={m.patientId} />
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

/**
 * Assistant replies come back as Markdown (the system prompt asks for tables
 * on structured/multi-record answers) — render it properly instead of
 * showing raw "**bold**"/"* item" syntax as plain text.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 flex flex-col gap-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 flex flex-col gap-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline text-[#009598]">{children}</a>
  ),
  code: ({ children }) => (
    <code className="bg-black/5 rounded-[4px] px-1 py-[1px] text-[12px]">{children}</code>
  ),
  h1: ({ children }) => <p className="text-[14px] font-semibold mb-1">{children}</p>,
  h2: ({ children }) => <p className="text-[14px] font-semibold mb-1">{children}</p>,
  h3: ({ children }) => <p className="text-[13px] font-semibold mb-1">{children}</p>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-[8px] border border-[#dedee1]">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#f2f3f3]">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-[6px] text-[11px] font-medium text-[#57575f] uppercase tracking-wider border-b border-[#dedee1] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-[6px] text-[12px] border-b border-[#dedee1] align-top">{children}</td>
  ),
};

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

/** Three bouncing dots — shown the moment a message is sent, before the first tool call or text token arrives. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] py-[3px]" aria-label="Thinking…">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[6px] h-[6px] rounded-full bg-[#57575f]/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

function Bubble({
  role,
  content,
  sources,
  patientId,
  toolStatus,
}: {
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
  patientId?: number | null;
  toolStatus?: string | null;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={
            isUser
              ? "bg-[#009598] text-white rounded-[14px] rounded-tr-[4px] px-3.5 py-2.5 text-[13px] font-normal leading-[19px] break-words"
              : "bg-[#f6f6f6] text-[#11111c] rounded-[14px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] font-normal leading-[19px] break-words"
          }
        >
          {content ? <Markdown content={content} /> : toolStatus ? null : <TypingDots />}
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
        {!isUser && patientId != null && (
          <Link
            href={`/patients/${patientId}`}
            className="flex items-center gap-1 text-[11px] font-medium text-[#009598] hover:underline px-1"
          >
            <UserRound size={11} /> View full patient profile
          </Link>
        )}
      </div>
    </div>
  );
}
