"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  hint?: string;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select…",
  hint,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full border rounded-lg px-3 py-2.5 text-[14px] text-left transition-colors bg-background ${
          open ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/40"
        }`}
      >
        <span className={selected.length === 0 ? "text-muted" : "text-foreground truncate"}>
          {selected.length === 0
            ? placeholder
            : selected.length <= 2
              ? selectedLabels
              : `${selected.length} selected`}
        </span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg overflow-hidden dropdown-enter">
            {/* Search */}
            {options.length > 5 && (
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full px-2.5 py-1.5 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            )}

            {/* Select All */}
            <button
              type="button"
              onClick={selectAll}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-semibold text-primary hover:bg-primary-faint border-b border-border transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                  selected.length === options.length
                    ? "bg-primary border-primary"
                    : selected.length > 0
                      ? "border-primary bg-primary/20"
                      : "border-border"
                }`}
              >
                {selected.length === options.length && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {selected.length > 0 && selected.length < options.length && (
                  <div className="w-2 h-0.5 bg-primary rounded" />
                )}
              </div>
              {selected.length === options.length ? "Deselect All" : "Select All"}
            </button>

            {/* Options */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-[13px] text-muted text-center">No matches</div>
              ) : (
                filtered.map((option) => {
                  const checked = selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggle(option.value)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                        checked ? "bg-primary-faint text-primary font-semibold" : "text-foreground hover:bg-primary-faint/50"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          checked ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <span>{option.label}</span>
                      <span className="ml-auto text-[11px] text-muted font-mono">{option.value}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {selected.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-primary-faint text-primary rounded-md"
              >
                {opt?.label || v}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="hover:text-danger transition-colors"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}
