"use client";

import { Input } from "@/components/ui/input";

export default function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-shrink-0">
      <Input
        type="text"
        placeholder="Recherche"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-80"
      />
    </div>
  );
}
