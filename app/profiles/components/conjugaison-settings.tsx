"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const GROUPES: { value: number; label: string; selectedClass: string }[] = [
  { value: 1, label: "1er groupe", selectedClass: "border-blue-400 bg-blue-100 text-blue-800" },
  { value: 2, label: "2e groupe", selectedClass: "border-yellow-400 bg-yellow-100 text-yellow-800" },
  { value: 3, label: "3e groupe", selectedClass: "border-orange-400 bg-orange-100 text-orange-800" },
];

export default function ConjugaisonSettings({
  showRadical,
  onShowRadicalChange,
  groupes,
  onGroupesChange,
}: {
  showRadical: boolean;
  onShowRadicalChange: (v: boolean) => void;
  groupes: number[];
  onGroupesChange: (v: number[]) => void;
}) {
  const toggleGroupe = (g: number) => {
    onGroupesChange(
      groupes.includes(g) ? groupes.filter((x) => x !== g) : [...groupes, g]
    );
  };

  return (
    <fieldset className="space-y-3 pt-4 border-t">
      <legend className="text-foreground text-sm leading-none font-medium">
        Conjugaison
      </legend>

      <div className="flex items-center gap-2">
        <Checkbox
          id="conjugaison_show_radical"
          checked={showRadical}
          onCheckedChange={(c) => onShowRadicalChange(c === true)}
        />
        <Label htmlFor="conjugaison_show_radical" className="cursor-pointer">
          Afficher le radical
        </Label>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">Groupes des verbes</p>
        <div className="flex gap-1.5 flex-wrap">
          {GROUPES.map((g) => {
            const selected = groupes.includes(g.value);
            return (
              <label
                key={g.value}
                className={`relative flex cursor-pointer items-center justify-center rounded-full border px-3 py-1 text-xs font-medium shadow-xs transition-[color,box-shadow] ${
                  selected
                    ? g.selectedClass
                    : "border-input bg-background text-foreground"
                }`}
              >
                <Checkbox
                  className="sr-only after:absolute after:inset-0"
                  checked={selected}
                  onCheckedChange={() => toggleGroupe(g.value)}
                />
                <span aria-hidden="true">{g.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
