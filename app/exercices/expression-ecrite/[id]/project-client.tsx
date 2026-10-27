"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { cn } from "@/lib/utils";
import { ArrowLeft, History, Loader2, MessagesSquare, PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AttemptView } from "../components/attempt-view";
import { OutlineChat } from "../components/outline-chat";
import { formatDate, score100Classes } from "../components/shared";
import { WritingEditor } from "../components/writing-editor";
import type { Attempt, Project } from "../types";

type Tab = "outline" | "writing" | "attempts";

export default function ProjectClient({ projectId }: { projectId: string }) {
  const { profile } = useCurrentProfile();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("outline");
  const [selectedAttempt, setSelectedAttempt] = useState<number | null>(null);
  // Bumped to remount the editor (fresh draft after a submission)
  const [editorKey, setEditorKey] = useState(0);
  const [openDictation, setOpenDictation] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    fetch(`/api/writing/${projectId}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Expression écrite introuvable");
        const p = data.project as Project;
        setProject(p);
        setTab(p.status === "planning" ? "outline" : "writing");
        setSelectedAttempt(p.attempts.at(-1)?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, [projectId, profile?.id]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-gray-500">
        <p>{error}</p>
        <Link href="/exercices/expression-ecrite" className="mt-4 inline-block text-sky-700 underline">
          Retour aux expressions écrites
        </Link>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lastAttempt = project.attempts.at(-1) ?? null;
  const attempt = project.attempts.find((a) => a.id === selectedAttempt) ?? lastAttempt;

  // The step the student is on is shown in the list ("Trame en discussion" / brouillon)
  const saveStatus = (status: Project["status"]) => {
    if (status === project.status) return;
    setProject({ ...project, status });
    fetch(`/api/writing/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  };
  const openTab = (key: Tab) => {
    setTab(key);
    if (key === "outline") saveStatus("planning");
    if (key === "writing") saveStatus("writing");
  };
  const goToOutline = () => openTab("outline");

  const tabs: { key: Tab; label: string; icon: typeof PenLine; disabled?: boolean }[] = [
    { key: "outline", label: "1. Ma trame", icon: MessagesSquare },
    { key: "writing", label: "2. J'écris", icon: PenLine, disabled: !project.outline },
    {
      key: "attempts",
      label: `3. Mes essais${project.attempts.length ? ` (${project.attempts.length})` : ""}`,
      icon: History,
      disabled: !project.attempts.length,
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div>
        <Link
          href="/exercices/expression-ecrite"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Expressions écrites
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{project.title ?? "Nouveau sujet"}</h1>
        <p className="text-sm text-muted-foreground">Objectif : au moins {project.min_words} mots</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, icon: Icon, disabled }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpenDictation(false);
              openTab(key);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40",
              tab === key ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "outline" && (
        <OutlineChat
          projectId={project.id}
          initialMessages={project.chat}
          currentOutline={project.outline}
          currentTitle={project.title}
          onMessagesChange={(chat) => setProject((p) => (p ? { ...p, chat } : p))}
          onValidated={(title, outline) => {
            setProject((p) =>
              p ? { ...p, title, outline, status: "writing", outline_validated_at: new Date().toISOString() } : p
            );
            setTab("writing");
          }}
        />
      )}

      {tab === "writing" && (
        <WritingEditor
          key={editorKey}
          project={project}
          lastAttempt={lastAttempt}
          initialDictationOpen={openDictation}
          onEditOutline={goToOutline}
          onSubmitted={(a: Attempt) => {
            setProject((p) =>
              p && {
                ...p,
                attempts: [...p.attempts, a],
                draft_text: "",
                draft_active_seconds: 0,
                draft_updated_at: new Date().toISOString(),
              }
            );
            setSelectedAttempt(a.id);
            setEditorKey((k) => k + 1);
            setTab("attempts");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {tab === "attempts" && attempt && (
        <div className="space-y-4">
          {project.attempts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {project.attempts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAttempt(a.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                    a.id === attempt.id ? "border-sky-500 bg-sky-50" : "bg-white hover:bg-gray-50"
                  )}
                >
                  Essai {a.number}
                  <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", score100Classes(a.scores.global))}>
                    {a.scores.global}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </button>
              ))}
            </div>
          )}
          <AttemptView
            key={attempt.id}
            attempt={attempt}
            onNewAttempt={(dictation) => {
              setOpenDictation(dictation);
              setEditorKey((k) => k + 1);
              setTab("writing");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}
