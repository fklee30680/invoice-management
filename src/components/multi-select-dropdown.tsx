"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectDropdownOption = {
  disabled?: boolean;
  group?: string;
  id: string;
  inactive?: boolean;
  label: string;
};

export function MultiSelectDropdown({
  clearLabel = "Clear selections",
  emptyLabel,
  initialSelected = [],
  inputNameForOption,
  inputValueForOption,
  isClearDisabled,
  formId,
  name,
  onNormalizeSelection,
  options,
  placeholder,
  summaryPluralLabel,
  triggerClassName,
}: {
  clearLabel?: string;
  emptyLabel: string;
  initialSelected?: string[];
  inputNameForOption?: (id: string) => string;
  inputValueForOption?: (id: string) => string;
  isClearDisabled?: (selected: string[]) => boolean;
  formId?: string;
  name?: string;
  onNormalizeSelection?: (selected: string[], previous: string[]) => string[];
  options: MultiSelectDropdownOption[];
  placeholder: string;
  summaryPluralLabel: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionById = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function setNormalizedSelection(next: string[]) {
    setSelected((previous) => onNormalizeSelection?.(next, previous) || next);
  }

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected
            .map((id) => optionById.get(id)?.label || `${id} (inactive)`)
            .join(", ")
        : `${selected.length} ${summaryPluralLabel} selected`;
  const clearDisabled = isClearDisabled?.(selected) || false;
  const groupedOptions = options.reduce<
    { group: string; options: MultiSelectDropdownOption[] }[]
  >((groups, option) => {
    const groupName = option.group || "";
    const group = groups.find((item) => item.group === groupName);
    if (group) {
      group.options.push(option);
    } else {
      groups.push({ group: groupName, options: [option] });
    }
    return groups;
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {selected.map((id) => {
        const inputName = inputNameForOption?.(id) || name;
        if (!inputName) return null;
        return (
          <input
            form={formId}
            key={id}
            name={inputName}
            type="hidden"
            value={inputValueForOption?.(id) || id}
          />
        );
      })}
      <button
        aria-expanded={open}
        className={
          triggerClassName ||
          "focus-ring flex min-h-10 w-full items-center justify-between gap-3 border border-[var(--line)] bg-white px-3 py-2 text-left text-sm font-normal normal-case text-[var(--foreground)]"
        }
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className={selected.length === 0 ? "text-[var(--muted)]" : ""}>
          {summary}
        </span>
        <span aria-hidden="true" className="text-[var(--muted)]">
          v
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-full overflow-auto border border-[var(--line)] bg-white p-2 shadow-lg">
          {options.length > 0 ? (
            <div className="grid gap-2">
              {groupedOptions.map((group) => (
                <div className="grid gap-1" key={group.group || "options"}>
                  {group.group ? (
                    <div className="px-2 pt-1 text-xs font-semibold uppercase text-[var(--muted)]">
                      {group.group}
                    </div>
                  ) : null}
                  {group.options.map((option) => (
                    <label
                      className={`flex items-center gap-2 px-2 py-1.5 text-sm ${
                        option.inactive ? "text-[var(--muted)]" : "text-[var(--foreground)]"
                      } ${
                        option.disabled
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-slate-100"
                      }`}
                      key={option.id}
                    >
                      <input
                        checked={selected.includes(option.id)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        disabled={option.disabled}
                        onChange={(event) => {
                          const next = event.currentTarget.checked
                            ? [...selected, option.id]
                            : selected.filter((id) => id !== option.id);
                          setNormalizedSelection(Array.from(new Set(next)));
                        }}
                        type="checkbox"
                      />
                      <span>
                        {option.label}
                        {option.inactive ? " (inactive)" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-sm text-[var(--muted)]">
              {emptyLabel}
            </div>
          )}
          <button
            className="focus-ring mt-2 w-full border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={clearDisabled}
            onClick={() => setNormalizedSelection([])}
            type="button"
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
