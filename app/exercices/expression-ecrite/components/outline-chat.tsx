"use client";

import { DictationButton } from "@/components/dictation-button";
import { playText, SpeakButton, stopSpeech } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "@/lib/writing/schema";
import { cn } from "@/lib/utils";
import { CheckCircle2, GraduationCap, Loader2, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { OutlineListenButton } from "./audio";
import { RichMd } from "./shared";

const AUTO_READ_KEY = "writing-chat-auto-read";

/** The numbered proposals of a coach message ("1. …"), to pick with one click. */
function choicesOf(text: string) {
  return [...text.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm)].map((m) => ({
    number: m[1],
    text: m[2].replace(/\*\*/g, "").trim(),
  }));
}

/**
 * Step 1 — the student builds the subject and the outline by talking with the
 * coach (typed or dictated messages, answers read aloud), then validates it.
 */
export function OutlineChat({
  projectId,
  initialMessages,
  currentOutline,
  currentTitle,
  onMessagesChange,
  onValidated,
}: {
  projectId: string;
  initialMessages: ChatMessage[];
  currentOutline: string | null;
  currentTitle: string | null;
  /** Keeps the parent's copy of the discussion up to date */
  onMessagesChange: (messages: ChatMessage[]) => void;
  onValidated: (title: string, outline: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [draft, setDraft] = useState<{ title: string; outline: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    try {
      setAutoRead(localStorage.getItem(AUTO_READ_KEY) === "1");
    } catch {}
  }, []);

  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    if (!next) stopSpeech();
    try {
      localStorage.setItem(AUTO_READ_KEY, next ? "1" : "0");
    } catch {}
  };

  const send = async (message: string | null) => {
    const history: ChatMessage[] = message ? [...messages, { role: "user", content: message }] : messages;
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    stopSpeech();
    let text = "";
    try {
      const res = await fetch(`/api/writing/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Le prof n'est pas disponible");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: text }]);
        bottom.current?.scrollIntoView({ block: "nearest" });
      }
      onMessagesChange([...history, { role: "assistant", content: text }]);
      if (autoRead && text.trim()) playText(text, () => {}).catch(() => {});
    } catch (e) {
      // The message stays in the box so it can be sent again
      if (message) setInput(message);
      setMessages(messages);
      toast.error(e instanceof Error ? e.message : "Le prof n'est pas disponible");
    } finally {
      setStreaming(false);
    }
  };

  // The coach opens the discussion with subject ideas
  useEffect(() => {
    if (opened.current || initialMessages.length > 0) return;
    opened.current = true;
    send(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [draft]);

  const prepareOutline = async () => {
    setDrafting(true);
    try {
      const res = await fetch(`/api/writing/${projectId}/outline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.outline);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "La trame n'a pas pu être préparée");
    } finally {
      setDrafting(false);
    }
  };

  const validate = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/writing/${projectId}/outline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      onValidated(draft.title, draft.outline);
    } catch {
      toast.error("La trame n'a pas pu être enregistrée");
    } finally {
      setSaving(false);
    }
  };

  const hasStudentMessage = messages.some((m) => m.role === "user");
  const last = messages[messages.length - 1];
  const showQuickReplies = !streaming && !draft && last?.role === "assistant" && !!last.content.trim();
  const choices = showQuickReplies ? choicesOf(last.content) : [];
  // The coach says the outline is complete: validating is the next step
  const outlineReady = showQuickReplies && !choices.length && last.content.includes("Valider la trame");

  return (
    <div className="space-y-4">
      {currentOutline && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Ma trame actuelle{currentTitle ? ` : ${currentTitle}` : ""}
          </summary>
          <RichMd className="mt-3 text-sm text-gray-800">{currentOutline}</RichMd>
        </details>
      )}

      <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-sky-800">
            <GraduationCap className="size-4" /> On cherche ton sujet ensemble
          </span>
          <button
            type="button"
            onClick={toggleAutoRead}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              autoRead ? "bg-sky-600 text-white" : "bg-white text-sky-700 hover:bg-sky-100"
            )}
            title="Lire les réponses du prof à voix haute"
          >
            {autoRead ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            Lecture auto
          </button>
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-sky-600 px-4 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex max-w-[92%] gap-1 rounded-2xl bg-white px-4 py-3 text-sm text-gray-800 shadow-xs">
                {m.content ? (
                  <RichMd className="flex-1">{m.content}</RichMd>
                ) : (
                  <Loader2 className="size-4 animate-spin text-sky-500" />
                )}
                {m.content && !(streaming && i === messages.length - 1) && (
                  <SpeakButton text={m.content} className="-my-1" />
                )}
              </div>
            )
          )}

          {showQuickReplies && (
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => (
                <Button
                  key={c.number}
                  size="sm"
                  variant="outline"
                  className="border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                  title={c.text}
                  onClick={() => send(`Je choisis la ${c.number} : ${c.text}`)}
                >
                  Je choisis la {c.number}
                </Button>
              ))}
              {choices.length > 0 && (
                <Button size="sm" variant="ghost" className="text-sky-700" onClick={() => send("Propose-moi d'autres idées.")}>
                  Autre chose
                </Button>
              )}
              {outlineReady ? (
                <Button size="sm" onClick={prepareOutline} disabled={drafting}>
                  {drafting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Valider la trame
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="text-sky-700" onClick={() => send("Je ne sais pas, choisis pour moi.")}>
                  Choisis pour moi
                </Button>
              )}
            </div>
          )}

          {draft && (
            <div className="space-y-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <Sparkles className="size-4" /> Voici ta trame. Elle te convient ?
              </p>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onPaste={(e) => e.preventDefault()}
                className="bg-white font-semibold"
                aria-label="Titre"
              />
              <RichMd className="rounded-lg bg-white p-3 text-sm text-gray-800">{draft.outline}</RichMd>
              <div className="flex flex-wrap gap-2">
                <Button onClick={validate} disabled={saving || !draft.title.trim()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Valider et commencer à écrire
                </Button>
                <OutlineListenButton projectId={projectId} outline={draft.outline} />
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Continuer la discussion
                </Button>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !streaming) send(input.trim());
          }}
        >
          <DictationButton
            disabled={streaming}
            onInterim={setInterim}
            onText={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
          />
          <input
            value={interim || input}
            onChange={(e) => setInput(e.target.value)}
            readOnly={!!interim}
            maxLength={2000}
            placeholder="Écris ou dicte ta réponse au prof…"
            className="h-9 min-w-0 flex-1 rounded-md border border-sky-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
          />
          <Button type="submit" size="icon" className="size-9" disabled={!input.trim() || streaming} title="Envoyer">
            <Send className="size-4" />
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-xs">
        <p className="text-sm text-muted-foreground">
          Dès qu&apos;une histoire te plaît, valide ta trame : le prof complétera ce qui manque.
        </p>
        <Button onClick={prepareOutline} disabled={!hasStudentMessage || streaming || drafting} variant="secondary">
          {drafting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Valider la trame
        </Button>
      </div>
    </div>
  );
}
