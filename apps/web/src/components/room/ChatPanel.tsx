"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessageView } from "@syncstream/contracts";
import { Button, Input } from "@/components/ui";

type Props = {
  messages: ChatMessageView[];
  typing: Array<{ userId: string; name: string }>;
  reactions: Array<{ id: string; name: string; emoji: string }>;
  error: string | null;
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onReact: (emoji: string) => void;
};

const EMOJIS = ["🔥", "😂", "👏", "❤️", "😮"];

export function ChatPanel({
  messages,
  typing,
  reactions,
  error,
  onSend,
  onTyping,
  onReact,
}: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
    onTyping(false);
  }

  function onChange(value: string) {
    setText(value);
    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 1200);
  }

  return (
    <div className="card flex h-full min-h-[320px] flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-medium text-white">Chat</h3>
        <div className="flex gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-lg px-1.5 py-0.5 text-sm hover:bg-white/10"
              onClick={() => onReact(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium text-accent-soft">{m.name}</span>
            <span className="text-slate-500"> · </span>
            <span className="text-slate-200">{m.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />

        {reactions.length > 0 && (
          <div className="pointer-events-none absolute inset-x-4 bottom-2 flex flex-wrap gap-2">
            {reactions.map((r) => (
              <span
                key={r.id}
                className="animate-bounce rounded-full bg-black/50 px-2 py-1 text-lg"
                title={r.name}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        )}
      </div>

      {typing.length > 0 && (
        <p className="px-4 text-xs text-slate-500">
          {typing.map((t) => t.name).join(", ")} typing…
        </p>
      )}
      {error && <p className="px-4 text-xs text-rose-300">{error}</p>}

      <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={submit}>
        <Input
          placeholder="Say something…"
          value={text}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}