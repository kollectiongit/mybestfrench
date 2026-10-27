"use client";

import { SpeakButton } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GraduationCap, HelpCircle, Loader2, Send, X } from "lucide-react";
import { createContext, useContext, useRef, useState } from "react";
import { Md } from "./shared";

/** Id of the exercise the widgets belong to (needed to ask the tutor). */
export const ExerciseIdContext = createContext<number | null>(null);

const MAX_QUESTIONS = 6;

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * « Pourquoi ? » — opens a short conversation with the tutor about one item
 * the student has just answered. The answer streams in as it is written.
 */
export function WhyChat({ itemKey }: { itemKey: string }) {
  const exerciseId = useContext(ExerciseIdContext);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  if (exerciseId == null) return null;

  const ask = async (question: string) => {
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch(`/api/training/exercises/${exerciseId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: itemKey, messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Le prof n'est pas disponible");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: text }]);
        bottom.current?.scrollIntoView({ block: "nearest" });
      }
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: e instanceof Error ? e.message : "Le prof n'est pas disponible" },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (messages.length === 0) ask("Pourquoi ?");
        }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
      >
        <HelpCircle className="size-3.5" /> Pourquoi ?
      </button>
    );
  }

  const questions = messages.filter((m) => m.role === "user").length;

  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
          <GraduationCap className="size-4" /> Le prof t&apos;explique
        </span>
        <button type="button" onClick={() => setOpen(false)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100" title="Fermer">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] rounded-xl bg-sky-600 px-3 py-1.5 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex gap-1 rounded-xl bg-white px-3 py-2 text-sm text-gray-800 shadow-xs">
              {m.content ? (
                <div className="flex-1 whitespace-pre-wrap">
                  <Md>{m.content}</Md>
                </div>
              ) : (
                <Loader2 className="size-4 animate-spin text-sky-500" />
              )}
              {m.content && !(streaming && i === messages.length - 1) && (
                <SpeakButton text={m.content} className="-my-1" />
              )}
            </div>
          )
        )}
        <div ref={bottom} />
      </div>

      {questions < MAX_QUESTIONS ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !streaming) ask(input.trim());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Pose une autre question au prof…"
            className={cn(
              "h-9 flex-1 rounded-md border border-sky-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
            )}
          />
          <Button type="submit" size="icon" className="size-9" disabled={!input.trim() || streaming} title="Envoyer">
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">On passe à la suite ? Tu pourras reposer tes questions plus tard.</p>
      )}
    </div>
  );
}
