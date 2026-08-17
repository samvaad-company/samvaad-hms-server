"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({ value, onChange, onSend, disabled, placeholder }: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  }

  return (
    <div className="flex items-end gap-2 px-3 py-3 border-t border-[#dedee1] bg-white shrink-0">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder ?? "Ask about patients, appointments, billing…"}
        className="flex-1 resize-none max-h-[120px] text-[13px] font-normal text-[#11111c] placeholder:text-[#57575f] bg-[#f6f6f6] rounded-[14px] px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-[#009598] disabled:opacity-60"
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="w-9 h-9 shrink-0 rounded-full bg-[#009598] flex items-center justify-center hover:bg-[#007f82] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ArrowUp size={16} className="text-white" strokeWidth={2} />
      </button>
    </div>
  );
}
