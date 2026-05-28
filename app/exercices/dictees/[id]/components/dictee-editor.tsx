"use client";

import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";

function getImageUrl(pictureFile: string | null) {
  if (!pictureFile) return null;
  return `/api/images/${pictureFile}`;
}

export default function DicteeEditor(props: {
  pictureFile: string | null;
  topicName: string;
  dictationText: string;
  setDictationText: (v: string) => void;
  disabled: boolean;
  lockReason: "perfect_score" | "daily_cap" | null;
  isValidating: boolean;
  validationMessage: string;
  onValidate: () => void;
  onFocus?: () => void;
  onChange?: () => void;
}) {
  const {
    pictureFile,
    topicName,
    dictationText,
    setDictationText,
    disabled,
    lockReason,
    isValidating,
    validationMessage,
    onValidate,
    onFocus,
    onChange,
  } = props;

  const textareaClass = (extra: string) =>
    `w-full ${extra} p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      disabled ? "bg-gray-100 cursor-not-allowed text-gray-700" : ""
    }`;

  const renderTextarea = (extraClasses: string) => {
    const textarea = (
      <textarea
        value={dictationText}
        onChange={(e) => {
          setDictationText(e.target.value);
          onChange?.();
        }}
        onFocus={() => onFocus?.()}
        placeholder="Écrivez votre dictée ici..."
        disabled={disabled}
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
        autoCapitalize="off"
        className={textareaClass(extraClasses)}
      />
    );

    if (lockReason === "perfect_score") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="block w-full">
              {textarea}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Cette dictée a déjà obtenu 10/10 et ne peut plus être re-soumise.
          </TooltipContent>
        </Tooltip>
      );
    }

    return textarea;
  };

  return (
    <div>
      {pictureFile ? (
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 flex">
            <div className="relative w-full h-full min-h-[100px] md:min-h-[200px]">
              <Image
                src={getImageUrl(pictureFile) || ""}
                alt={`Dictée - ${topicName}`}
                fill
                className="object-cover rounded-lg"
              />
            </div>
          </div>
          <div className="flex w-full">{renderTextarea("")}</div>
        </div>
      ) : (
        <div className="w-full">
          {renderTextarea("min-h-[100px] md:min-h-[200px]")}
        </div>
      )}

      {lockReason === "daily_cap" && (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Cette dictée a déjà été effectuée 3 fois aujourd&apos;hui. Réessaie
          demain.
        </p>
      )}

      {!disabled && (
        <div className="flex justify-end mt-2">
          <Button size="lg" onClick={onValidate} className="w-full">
            {isValidating ? (
              <TextShimmer
                duration={1.0}
                className=" [--base-color:var(--color-white)] [--base-gradient-color:var(--color-gray-800)] dark:[--base-color:var(--color-gray-700)] dark:[--base-gradient-color:var(--color-gray-400)]"
              >
                {validationMessage}
              </TextShimmer>
            ) : (
              "Valider"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
