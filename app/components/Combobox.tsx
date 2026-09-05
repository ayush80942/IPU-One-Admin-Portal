"use client";

import { useState, useRef, useEffect } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  label: string;
  /** Currently selected option's id, or "" for none. */
  value: string;
  /** What the closed trigger shows for `value` — the caller owns this since a search-backed
   *  combobox may not have the selected option loaded into its current result set. */
  displayValue: string;
  onSelect: (option: ComboboxOption | null) => void;
  /** Sync (client array) or async (server typeahead) — either is fine, called on open and on
   *  every keystroke, debounced when it returns a Promise. */
  search: (query: string) => ComboboxOption[] | Promise<ComboboxOption[]>;
  placeholder?: string;
  disabled?: boolean;
  /** Extra row pinned under the results, e.g. "+ Add new teacher". */
  onCreateNew?: { label: string; onClick: () => void };
  hint?: string;
}

export default function Combobox({
  label,
  value,
  displayValue,
  onSelect,
  search,
  placeholder = "Search…",
  disabled = false,
  onCreateNew,
  hint,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const runSearch = (q: string) => {
    const result = search(q);
    if (result instanceof Promise) {
      setLoading(true);
      result
        .then((opts) => setOptions(opts))
        .finally(() => setLoading(false));
    } else {
      setOptions(result);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    runSearch("");
  };

  const handlePick = (opt: ComboboxOption) => {
    onSelect(opt);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={`flex items-center justify-between w-full border rounded-lg px-3 py-2.5 text-[14px] text-left transition-colors bg-background ${
          disabled
            ? "border-border opacity-60 cursor-not-allowed"
            : open
              ? "border-primary ring-1 ring-primary/20"
              : "border-border hover:border-primary/40"
        }`}
      >
        <span className={value ? "text-foreground truncate" : "text-muted"}>{value ? displayValue : placeholder}</span>
        <svg
          className={`w-4 h-4 text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg overflow-hidden dropdown-enter">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full px-2.5 py-1.5 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="max-h-52 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-4 text-[13px] text-muted text-center">Searching…</div>
              ) : options.length === 0 ? (
                <div className="px-3 py-4 text-[13px] text-muted text-center">No matches</div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePick(opt)}
                    className={`w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left text-[13px] transition-colors ${
                      opt.value === value ? "bg-primary-faint text-primary font-semibold" : "text-foreground hover:bg-primary-faint/50"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.sublabel && <span className="text-[11px] text-muted">{opt.sublabel}</span>}
                  </button>
                ))
              )}
            </div>

            {onCreateNew && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onCreateNew.onClick();
                }}
                className="w-full px-3 py-2 text-left text-[13px] font-semibold text-primary hover:bg-primary-faint border-t border-border transition-colors"
              >
                + {onCreateNew.label}
              </button>
            )}
          </div>
        </div>
      )}

      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}
