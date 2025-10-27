"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSearchHistory } from "@/hooks/use-search-history";
import { ChevronsUpDown, CircleX, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { history, addSearch, removeFromHistory } = useSearchHistory();

  // Save to history when value changes (debounced by hook)
  useEffect(() => {
    if (value.trim()) {
      addSearch(value);
    }
  }, [value, addSearch]);

  // Filter history based on current input
  const filteredHistory = useMemo(() => {
    if (!value.trim()) {
      return history;
    }
    return history.filter((item) =>
      item.toLowerCase().includes(value.toLowerCase())
    );
  }, [history, value]);

  const handleClear = () => {
    onChange("");
  };

  const handleHistorySelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    removeFromHistory(item);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex-shrink-0 relative w-full md:w-80">
          <Input
            type="text"
            placeholder="Recherche"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full md:w-80 h-10 bg-gray-100 pr-20"
          />
          {/* Clear button */}
          {value && (
            <button
              onClick={handleClear}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <CircleX className="h-5 w-5" />
            </button>
          )}
          {/* Dropdown button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <ChevronsUpDown className="h-5 w-5" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] md:w-80 p-0"
        align="start"
      >
        <Command>
          <CommandList>
            <CommandEmpty>Aucun historique</CommandEmpty>
            {filteredHistory.length > 0 && (
              <CommandGroup heading="Historique de recherche">
                {filteredHistory.map((item, index) => (
                  <CommandItem
                    key={`${item}-${index}`}
                    onSelect={() => handleHistorySelect(item)}
                    className="group"
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    <span className="flex-1">{item}</span>
                    {hoveredItem === item && (
                      <button
                        onClick={(e) => handleRemoveHistoryItem(e, item)}
                        className="ml-2 p-1 hover:bg-gray-200 rounded"
                        type="button"
                      >
                        <CircleX className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
