"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import type { AnswerEntry, AnswerHandler, ItemResult, PublicPayload } from "../types";
import { Feedback, MARK_COLORS, Md } from "./shared";
import { WhyChat } from "./why-chat";

type Narrow<T extends PublicPayload["type"]> = Extract<PublicPayload, { type: T }>;

interface WidgetProps<T extends PublicPayload["type"]> {
  payload: Narrow<T>;
  answers: Record<string, AnswerEntry>;
  onAnswer: AnswerHandler;
  readOnly: boolean;
}

type ResultOf<K extends ItemResult["kind"]> = Extract<ItemResult, { kind: K }>;
// classify and label share the same result shape
type ListResult = Extract<ItemResult, { kind: "classify" | "label" }>;

/** Wraps onAnswer with a per-item pending flag. */
function useSubmit(onAnswer: AnswerHandler) {
  const [pending, setPending] = useState<string | null>(null);
  const submit = async (itemKey: string, answer: unknown) => {
    setPending(itemKey);
    try {
      await onAnswer(itemKey, answer);
    } finally {
      setPending(null);
    }
  };
  return { pending, submit };
}

function ValidateButton({
  onClick,
  disabled,
  pending,
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled || pending} className="gap-1.5">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      Valider
    </Button>
  );
}

// ---------------------------------------------------------------------------
// QCM
// ---------------------------------------------------------------------------

export function ChoiceWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"choice">) {
  const { pending, submit } = useSubmit(onAnswer);
  const [selection, setSelection] = useState<Record<string, number[]>>({});

  return (
    <div className="space-y-5">
      {payload.questions.map((q, qi) => {
        const result = answers[q.id]?.result as ResultOf<"choice"> | undefined;
        const selected = result?.selected ?? selection[q.id] ?? [];
        const locked = !!result || readOnly || pending === q.id;

        const toggle = (index: number) => {
          if (locked) return;
          if (!q.multiple) {
            // Single answer: validating on click gives immediate feedback
            submit(q.id, [index]);
            setSelection((s) => ({ ...s, [q.id]: [index] }));
            return;
          }
          setSelection((s) => {
            const cur = s[q.id] ?? [];
            return {
              ...s,
              [q.id]: cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index],
            };
          });
        };

        return (
          <div key={q.id} className="space-y-2">
            <div className="font-medium text-gray-900">
              <span className="mr-2 text-muted-foreground">{String.fromCharCode(97 + qi)}.</span>
              <Md>{q.prompt}</Md>
              {q.multiple && !result && (
                <span className="ml-2 text-xs text-muted-foreground">(plusieurs réponses)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map((option, oi) => {
                const isSelected = selected.includes(oi);
                const isCorrect = result?.correct.includes(oi);
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => toggle(oi)}
                    disabled={locked}
                    className={cn(
                      "rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                      !result && (isSelected
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-gray-200 bg-white hover:border-sky-300"),
                      result && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-800",
                      result && isSelected && !isCorrect && "border-rose-500 bg-rose-50 text-rose-800 line-through",
                      result && !isSelected && !isCorrect && "border-gray-200 bg-white text-gray-400"
                    )}
                  >
                    {pending === q.id && isSelected && !q.multiple ? (
                      <Loader2 className="inline size-4 animate-spin" />
                    ) : (
                      <Md>{option}</Md>
                    )}
                  </button>
                );
              })}
              {q.multiple && !result && !readOnly && (
                <ValidateButton
                  onClick={() => submit(q.id, selection[q.id] ?? [])}
                  disabled={!(selection[q.id]?.length)}
                  pending={pending === q.id}
                />
              )}
            </div>
            {result && (
              <Feedback
                correct={result.is_correct}
                title={result.is_correct ? "Bonne réponse !" : "Pas tout à fait."}
                speak={result.explanation}
              >
                <Md>{result.explanation}</Md>
              </Feedback>
            )}
            {result && <WhyChat itemKey={q.id} />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Texte à trous
// ---------------------------------------------------------------------------

export function FillBlanksWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"fill_blanks">) {
  const { pending, submit } = useSubmit(onAnswer);
  const [values, setValues] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);

  const insertWord = (word: string) => {
    // Fill the focused blank, else the first empty blank of an open sentence
    const open = payload.sentences.filter((s) => !answers[s.id]);
    const target =
      (focused && open.some((s) => s.blanks.some((b) => b.id === focused)) && focused) ||
      open.flatMap((s) => s.blanks).find((b) => !values[b.id]?.trim())?.id;
    if (target) setValues((v) => ({ ...v, [target]: word }));
  };

  return (
    <div className="space-y-4">
      {payload.word_bank.length > 0 && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Mots proposés :</span>
          {payload.word_bank.map((word) => (
            <button
              key={word}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertWord(word)}
              className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm font-semibold text-sky-800 hover:bg-sky-100"
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {payload.sentences.map((sentence, si) => {
        const result = answers[sentence.id]?.result as ResultOf<"fill_blanks"> | undefined;
        const filled = sentence.blanks.every((b) => values[b.id]?.trim());
        const send = () => submit(sentence.id, sentence.blanks.map((b) => values[b.id] ?? ""));

        return (
          <div key={sentence.id} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-y-2 leading-9">
              <span className="mr-2 text-muted-foreground">{String.fromCharCode(97 + si)}.</span>
              {sentence.parts.map((part, pi) => {
                const blank = sentence.blanks[pi];
                const graded = blank && result?.blanks.find((b) => b.id === blank.id);
                return (
                  <span key={pi} className="whitespace-pre-wrap">
                    {part}
                    {blank &&
                      (graded ? (
                        graded.correct ? (
                          <span className="rounded bg-emerald-100 px-1.5 font-semibold text-emerald-800">
                            {graded.given}
                          </span>
                        ) : (
                          <span className="inline-flex items-baseline gap-1">
                            {graded.given && (
                              <span className="rounded bg-rose-100 px-1.5 text-rose-700 line-through">
                                {graded.given}
                              </span>
                            )}
                            <span className="rounded bg-emerald-100 px-1.5 font-semibold text-emerald-800">
                              {graded.expected}
                            </span>
                          </span>
                        )
                      ) : (
                        <input
                          value={values[blank.id] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [blank.id]: e.target.value }))}
                          onFocus={() => setFocused(blank.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && filled) send();
                          }}
                          disabled={readOnly || pending === sentence.id}
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          className="mx-1 w-24 border-b-2 border-dashed border-sky-400 bg-sky-50/50 px-1 text-center font-semibold text-sky-900 outline-none focus:border-solid focus:bg-sky-50"
                          style={{ width: `${Math.max(5, (values[blank.id]?.length ?? 0) + 2)}ch` }}
                        />
                      ))}
                  </span>
                );
              })}
              {!result && !readOnly && (
                <span className="ml-3">
                  <ValidateButton onClick={send} disabled={!filled} pending={pending === sentence.id} />
                </span>
              )}
            </div>
            {result && (
              <div className="space-y-1.5">
                {result.blanks.map((b) => (
                  <Feedback
                    key={b.id}
                    correct={b.correct}
                    title={b.correct ? `« ${b.expected} » : juste !` : `Il fallait écrire « ${b.expected} »`}
                    speak={b.explanation}
                  >
                    <Md>{b.explanation}</Md>
                  </Feedback>
                ))}
                <WhyChat itemKey={sentence.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Souligner / entourer
// ---------------------------------------------------------------------------

export function MarkWordsWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"mark_words">) {
  const { pending, submit } = useSubmit(onAnswer);
  const [activeKey, setActiveKey] = useState(payload.legend[0]?.key);
  const [marks, setMarks] = useState<Record<string, Record<number, string>>>({});
  const colorOf = (key: string) =>
    MARK_COLORS[payload.legend.find((l) => l.key === key)?.color ?? "blue"];

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {payload.legend.length > 1 ? "Choisis ta couleur :" : "Clique sur les mots :"}
          </span>
          {payload.legend.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setActiveKey(l.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-medium",
                activeKey === l.key ? `${MARK_COLORS[l.color].border} ${MARK_COLORS[l.color].bg}` : "border-gray-200"
              )}
            >
              <span className={cn("size-3 rounded-full", MARK_COLORS[l.color].dot)} />
              {l.label}
            </button>
          ))}
        </div>
      )}

      {payload.sentences.map((sentence, si) => {
        const result = answers[sentence.id]?.result as ResultOf<"mark_words"> | undefined;
        const answered = answers[sentence.id]?.answer as { i: number; key: string }[] | undefined;
        const current = marks[sentence.id] ?? {};
        const studentMarks: Record<number, string> = result
          ? Object.fromEntries((answered ?? []).map((m) => [m.i, m.key]))
          : current;

        const toggle = (index: number) => {
          if (result || readOnly || !activeKey) return;
          setMarks((m) => {
            const next = { ...(m[sentence.id] ?? {}) };
            if (next[index] === activeKey) delete next[index];
            else next[index] = activeKey;
            return { ...m, [sentence.id]: next };
          });
        };

        const targetAt = (i: number) => result?.targets.find((t) => i >= t.start && i <= t.end);

        return (
          <div key={sentence.id} className="space-y-2">
            <div className="text-lg leading-10">
              <span className="mr-2 text-base text-muted-foreground">{String.fromCharCode(97 + si)}.</span>
              {sentence.tokens.map((token, ti) => {
                const mark = studentMarks[ti];
                const target = targetAt(ti);
                const isExtra = result?.extras.includes(ti);
                const space = token.pre ? " " : "";
                if (!token.word) {
                  return (
                    <span key={ti} className="whitespace-pre">
                      {space}
                      {token.text}
                    </span>
                  );
                }
                return (
                  <span key={ti} className="whitespace-pre">
                    {space}
                    <button
                      type="button"
                      onClick={() => toggle(ti)}
                      disabled={!!result || readOnly}
                      className={cn(
                        // Padding compensated by a negative margin so highlights don't add spaces
                        "-mx-0.5 rounded px-0.5 transition-colors",
                        !result && !mark && !readOnly && "hover:bg-gray-100",
                        !result && mark && `${colorOf(mark).bg} ${colorOf(mark).text} border-b-[3px] ${colorOf(mark).border} font-semibold`,
                        result && target && `border-b-[3px] ${colorOf(target.key).border} ${target.correct ? colorOf(target.key).bg : "border-dashed"} font-semibold`,
                        result && isExtra && "bg-rose-100 text-rose-700 line-through decoration-rose-500"
                      )}
                    >
                      {token.text}
                    </button>
                  </span>
                );
              })}
              {!result && !readOnly && (
                <span className="ml-3 inline-flex items-center gap-1 align-middle">
                  {Object.keys(current).length > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Effacer"
                      onClick={() => setMarks((m) => ({ ...m, [sentence.id]: {} }))}
                    >
                      <Undo2 className="size-4" />
                    </Button>
                  )}
                  <ValidateButton
                    onClick={() =>
                      submit(
                        sentence.id,
                        Object.entries(current).map(([i, key]) => ({ i: Number(i), key }))
                      )
                    }
                    disabled={Object.keys(current).length === 0}
                    pending={pending === sentence.id}
                  />
                </span>
              )}
            </div>
            {result && (
              <div className="space-y-1.5">
                {result.targets.map((t) => (
                  <Feedback
                    key={t.id}
                    correct={t.correct}
                    title={
                      <>
                        « {t.text} » —{" "}
                        {payload.legend.find((l) => l.key === t.key)?.label ?? t.key}
                        {!t.correct && " (non trouvé)"}
                      </>
                    }
                    speak={t.explanation}
                  >
                    <Md>{t.explanation}</Md>
                  </Feedback>
                ))}
                {result.extras.length > 0 && (
                  <Feedback
                    correct={false}
                    title={`Marqué en trop : ${result.extras.map((i) => sentence.tokens[i]?.text).join(", ")}`}
                  />
                )}
                <WhyChat itemKey={sentence.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classer en colonnes
// ---------------------------------------------------------------------------

export function ClassifyWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"classify">) {
  const { pending, submit } = useSubmit(onAnswer);
  const result = answers.all?.result as ListResult | undefined;
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);

  const given: Record<string, string> = result
    ? Object.fromEntries(result.items.filter((i) => i.given).map((i) => [i.id, i.given as string]))
    : placement;
  const pool = payload.items.filter((i) => !given[i.id]);
  const locked = !!result || readOnly;
  const labelOf = (key: string) => payload.categories.find((c) => c.key === key)?.label ?? key;

  const place = (key: string) => {
    if (!picked || locked) return;
    setPlacement((p) => ({ ...p, [picked]: key }));
    setPicked(null);
  };

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="min-h-12 rounded-xl border-2 border-dashed border-gray-200 p-3">
          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tous les mots sont classés.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pool.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPicked(picked === item.id ? null : item.id)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1 text-sm font-medium",
                    picked === item.id ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200 bg-white hover:border-sky-300"
                  )}
                >
                  {item.text}
                </button>
              ))}
            </div>
          )}
          {picked && <p className="mt-2 text-xs text-sky-700">Maintenant, clique sur la bonne colonne.</p>}
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
        style={{ "--cols": Math.min(payload.categories.length, 4) } as React.CSSProperties}
      >
        {payload.categories.map((cat) => {
          const inside = payload.items.filter((i) => given[i.id] === cat.key);
          return (
            <div
              key={cat.key}
              onClick={() => place(cat.key)}
              className={cn(
                "min-h-28 rounded-xl border-2 bg-white p-2 transition-colors",
                picked && !locked ? "cursor-pointer border-sky-300 hover:bg-sky-50" : "border-gray-200"
              )}
            >
              <div className="mb-2 border-b pb-1 text-center text-sm font-bold text-gray-800">{cat.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {inside.map((item) => {
                  const graded = result?.items.find((r) => r.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlacement((p) => {
                          const next = { ...p };
                          delete next[item.id];
                          return next;
                        });
                      }}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-sm font-medium",
                        !graded && "bg-sky-100 text-sky-800",
                        graded?.correct && "bg-emerald-100 text-emerald-800",
                        graded && !graded.correct && "bg-rose-100 text-rose-700"
                      )}
                    >
                      {item.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="flex justify-end">
          <ValidateButton
            onClick={() => submit("all", Object.entries(placement).map(([id, key]) => ({ id, key })))}
            disabled={pool.length > 0}
            pending={pending === "all"}
          />
        </div>
      )}

      {result && (
        <div className="space-y-1.5">
          {result.items.filter((i) => !i.correct).length === 0 ? (
            <Feedback correct title="Tout est bien classé, bravo !" />
          ) : (
            result.items
              .filter((i) => !i.correct)
              .map((i) => (
                <Feedback
                  key={i.id}
                  correct={false}
                  title={`« ${payload.items.find((it) => it.id === i.id)?.text} » va dans « ${labelOf(i.expected)} »`}
                  speak={i.explanation}
                >
                  <Md>{i.explanation}</Md>
                </Feedback>
              ))
          )}
          <WhyChat itemKey="all" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étiqueter
// ---------------------------------------------------------------------------

export function LabelWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"label">) {
  const { pending, submit } = useSubmit(onAnswer);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const labelOf = (key: string) => payload.options.find((o) => o.key === key)?.label ?? key;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {payload.options.map((o) => (
          <span key={o.key}>
            <strong className="text-gray-700">{o.key}</strong> = {o.label}
          </span>
        ))}
      </div>
      {payload.items.map((item, ii) => {
        const result = answers[item.id]?.result as ListResult | undefined;
        const graded = result?.items[0];
        const selected = graded?.given ?? chosen[item.id];
        const locked = !!result || readOnly || pending === item.id;
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-muted-foreground">{String.fromCharCode(97 + ii)}.</span>
              <span className="font-medium text-gray-900">
                <Md>{item.text}</Md>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {payload.options.map((o) => {
                  const isSelected = selected === o.key;
                  const isExpected = graded?.expected === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      title={o.label}
                      disabled={locked}
                      onClick={() => {
                        setChosen((c) => ({ ...c, [item.id]: o.key }));
                        submit(item.id, o.key);
                      }}
                      className={cn(
                        "min-w-11 rounded-md border-2 px-2 py-0.5 text-sm font-bold",
                        !graded && (isSelected ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200 bg-white hover:border-sky-300"),
                        graded && isExpected && "border-emerald-500 bg-emerald-50 text-emerald-800",
                        graded && isSelected && !isExpected && "border-rose-500 bg-rose-50 text-rose-700 line-through",
                        graded && !isSelected && !isExpected && "border-gray-100 text-gray-300"
                      )}
                    >
                      {pending === item.id && isSelected ? <Loader2 className="inline size-4 animate-spin" /> : o.key}
                    </button>
                  );
                })}
              </span>
            </div>
            {graded && (
              <Feedback
                correct={graded.correct}
                title={graded.correct ? "Juste !" : `C'est « ${graded.expected} » : ${labelOf(graded.expected)}`}
                speak={graded.explanation}
              >
                <Md>{graded.explanation}</Md>
              </Feedback>
            )}
            {graded && <WhyChat itemKey={item.id} />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Réécriture / réponse courte (corrigées par l'IA si la réponse diffère)
// ---------------------------------------------------------------------------

export function OpenWidget({ payload, answers, onAnswer, readOnly }: WidgetProps<"rewrite" | "short_answer">) {
  const { pending, submit } = useSubmit(onAnswer);
  const [values, setValues] = useState<Record<string, string>>({});
  const isRewrite = payload.type === "rewrite";

  return (
    <div className="space-y-4">
      {payload.items.map((item, ii) => {
        const result = answers[item.id]?.result as ResultOf<"open"> | undefined;
        const value = values[item.id] ?? "";
        const send = () => value.trim() && submit(item.id, value.trim());
        return (
          <div key={item.id} className="space-y-2">
            <div className="font-medium text-gray-900">
              <span className="mr-2 text-muted-foreground">{String.fromCharCode(97 + ii)}.</span>
              <Md>{item.prompt}</Md>
            </div>
            {result ? (
              <div className="space-y-1.5 pl-5">
                <div
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium",
                    result.correct ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800 line-through decoration-rose-400"
                  )}
                >
                  {result.given}
                </div>
                <Feedback
                  correct={result.correct}
                  title={result.correct ? "Juste !" : `Réponse attendue : « ${result.expected} »`}
                  speak={[result.feedback, result.explanation].filter(Boolean).join(" ")}
                >
                  {result.feedback && (
                    <div className="mb-1">
                      <Md>{result.feedback}</Md>
                    </div>
                  )}
                  <Md>{result.explanation}</Md>
                </Feedback>
                <WhyChat itemKey={item.id} />
              </div>
            ) : (
              <div className="flex gap-2 pl-5">
                <input
                  value={value}
                  onChange={(e) => setValues((v) => ({ ...v, [item.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  disabled={readOnly || pending === item.id}
                  placeholder={isRewrite ? "Réécris ici…" : "Ta réponse…"}
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(
                    "h-9 rounded-md border-2 border-sky-200 bg-white px-3 text-base outline-none focus:border-sky-500",
                    isRewrite ? "flex-1" : "w-full max-w-xs"
                  )}
                />
                {!readOnly && (
                  <ValidateButton onClick={send} disabled={!value.trim()} pending={pending === item.id} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ExerciseWidget(props: {
  payload: PublicPayload;
  answers: Record<string, AnswerEntry>;
  onAnswer: AnswerHandler;
  readOnly: boolean;
}) {
  const { payload, ...rest } = props;
  switch (payload.type) {
    case "choice":
      return <ChoiceWidget payload={payload} {...rest} />;
    case "fill_blanks":
      return <FillBlanksWidget payload={payload} {...rest} />;
    case "mark_words":
      return <MarkWordsWidget payload={payload} {...rest} />;
    case "classify":
      return <ClassifyWidget payload={payload} {...rest} />;
    case "label":
      return <LabelWidget payload={payload} {...rest} />;
    case "rewrite":
    case "short_answer":
      return <OpenWidget payload={payload} {...rest} />;
  }
}
