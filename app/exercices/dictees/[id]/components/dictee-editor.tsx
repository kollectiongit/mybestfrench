"use client";

import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { Button } from "@/components/ui/button";
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
  isValidating: boolean;
  validationMessage: string;
  onValidate: () => void;
}) {
  const {
    pictureFile,
    topicName,
    dictationText,
    setDictationText,
    disabled,
    isValidating,
    validationMessage,
    onValidate,
  } = props;

  return (
    <div>
      {pictureFile ? (
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 flex">
            <div className="relative w-full h-full min-h-[200px]">
              <Image
                src={getImageUrl(pictureFile) || ""}
                alt={`Dictée - ${topicName}`}
                fill
                className="object-cover rounded-lg"
              />
            </div>
          </div>
          <div className="col-span-3 flex">
            <div className="w-full h-full min-h-[200px]">
              <textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Écrivez votre dictée ici..."
                disabled={disabled}
                className={`w-full h-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  disabled ? "bg-gray-100 cursor-not-allowed text-gray-700" : ""
                }`}
                style={{ minHeight: "200px", height: "200px" }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <textarea
            value={dictationText}
            onChange={(e) => setDictationText(e.target.value)}
            placeholder="Écrivez votre dictée ici..."
            disabled={disabled}
            className={`w-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              disabled ? "bg-gray-100 cursor-not-allowed text-gray-700" : ""
            }`}
            style={{ minHeight: "200px", height: "200px" }}
          />
        </div>
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
