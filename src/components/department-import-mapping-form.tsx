"use client";

import { useMemo, useState } from "react";
import type { DepartmentImportSettings } from "@/lib/types";

type HeaderOption = {
  index: number;
  letter: string;
  label: string;
};

type MappingKey =
  | "departmentNameColumn"
  | "departmentEmailColumn"
  | "departmentHeadNameColumn"
  | "departmentHeadEmailColumn"
  | "escalationNameColumn"
  | "escalationEmailColumn";

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveSavedValue(options: HeaderOption[], saved: string) {
  const trimmed = saved.trim();
  if (!trimmed) return "";
  const normalized = normalizeHeader(trimmed);
  const headerMatch = options.find((option) => normalizeHeader(option.label) === normalized);
  if (headerMatch) return headerMatch.label;
  const letterMatch = options.find((option) => option.letter.toLowerCase() === trimmed.toLowerCase());
  if (letterMatch) return letterMatch.label;
  if (/^\d+$/.test(trimmed)) {
    const numberMatch = options[Number(trimmed) - 1];
    if (numberMatch) return numberMatch.label;
  }
  return "";
}

function MappingSelect({
  label,
  name,
  onChange,
  options,
  required,
  value,
}: {
  label: string;
  name: MappingKey;
  onChange: (name: MappingKey, value: string) => void;
  options: HeaderOption[];
  required?: boolean;
  value: string;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-[var(--muted)]">
      {label} {required ? <span className="text-red-700">*</span> : null}
      <input name={name} type="hidden" value={value} />
      <select
        className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
        onChange={(event) => onChange(name, event.target.value)}
        value={value}
      >
        <option value="">{required ? "Select column" : "Do not import"}</option>
        {options.map((option) => (
          <option key={`${option.letter}-${option.label}`} value={option.label}>
            {option.label || "(blank header)"} - Column {option.letter}
          </option>
        ))}
      </select>
      {options.length === 0 ? (
        <span className="mt-1 block text-xs font-normal normal-case text-[var(--muted)]">
          Select a file to load header options.
        </span>
      ) : null}
    </label>
  );
}

export function DepartmentImportMappingForm({
  settings,
}: {
  settings: DepartmentImportSettings;
}) {
  const [headerRow, setHeaderRow] = useState(settings.headerRow);
  const [headers, setHeaders] = useState<HeaderOption[]>([]);
  const [previewMessage, setPreviewMessage] = useState("");
  const [mapping, setMapping] = useState<Record<MappingKey, string>>({
    departmentNameColumn: settings.departmentNameColumn,
    departmentEmailColumn: settings.departmentEmailColumn,
    departmentHeadNameColumn: settings.departmentHeadNameColumn,
    departmentHeadEmailColumn: settings.departmentHeadEmailColumn,
    escalationNameColumn: settings.escalationNameColumn,
    escalationEmailColumn: settings.escalationEmailColumn,
  });

  const options = useMemo(() => headers, [headers]);

  function applyHeaders(nextOptions: HeaderOption[]) {
    setHeaders(nextOptions);
    setMapping({
      departmentNameColumn: resolveSavedValue(nextOptions, settings.departmentNameColumn),
      departmentEmailColumn: resolveSavedValue(nextOptions, settings.departmentEmailColumn),
      departmentHeadNameColumn: resolveSavedValue(nextOptions, settings.departmentHeadNameColumn),
      departmentHeadEmailColumn: resolveSavedValue(nextOptions, settings.departmentHeadEmailColumn),
      escalationNameColumn: resolveSavedValue(nextOptions, settings.escalationNameColumn),
      escalationEmailColumn: resolveSavedValue(nextOptions, settings.escalationEmailColumn),
    });
  }

  async function previewFile(file: File | undefined, nextHeaderRow = headerRow) {
    if (!file) {
      setHeaders([]);
      setPreviewMessage("");
      return;
    }
    const formData = new FormData();
    formData.set("departmentFile", file);
    formData.set("headerRow", String(nextHeaderRow));
    setPreviewMessage("Loading header preview...");
    const response = await fetch("/api/department-import/preview", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as {
      headers?: HeaderOption[];
      errors?: string[];
    };
    if (!response.ok || (result.errors && result.errors.length > 0)) {
      setHeaders([]);
      setPreviewMessage(result.errors?.join(" ") || "Header preview failed.");
      return;
    }
    setPreviewMessage("");
    applyHeaders(result.headers || []);
  }

  function updateMapping(name: MappingKey, nextValue: string) {
    setMapping((current) => ({ ...current, [name]: nextValue }));
  }

  return (
    <>
      <section>
        <h3 className="text-sm font-semibold">File And Header</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Department File
            <input
              accept=".csv,.xlsx,.xls"
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
              name="departmentFile"
              onChange={(event) => previewFile(event.target.files?.[0])}
              required
              type="file"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Header Row
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              min={1}
              name="headerRow"
              onChange={(event) => {
                const next = Math.max(Number(event.target.value) || 1, 1);
                setHeaderRow(next);
                const fileInput = event.currentTarget
                  .closest("form")
                  ?.querySelector<HTMLInputElement>('input[name="departmentFile"]');
                void previewFile(fileInput?.files?.[0], next);
              }}
              required
              type="number"
              value={headerRow}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Column Mapping</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MappingSelect
            label="Department Column"
            name="departmentNameColumn"
            onChange={updateMapping}
            options={options}
            required
            value={mapping.departmentNameColumn}
          />
          <MappingSelect
            label="Department Email Column"
            name="departmentEmailColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.departmentEmailColumn}
          />
          <MappingSelect
            label="Department Head Name Column"
            name="departmentHeadNameColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.departmentHeadNameColumn}
          />
          <MappingSelect
            label="Department Head Email Column"
            name="departmentHeadEmailColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.departmentHeadEmailColumn}
          />
          <MappingSelect
            label="Department Escalation Name Column"
            name="escalationNameColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.escalationNameColumn}
          />
          <MappingSelect
            label="Department Escalation Email Column"
            name="escalationEmailColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.escalationEmailColumn}
          />
        </div>
        {previewMessage ? (
          <p className="mt-2 text-xs text-amber-800">{previewMessage}</p>
        ) : null}
        {options.length > 0 ? (
          <div className="mt-3 border border-[var(--line)] bg-white p-3 text-xs">
            <div className="font-semibold uppercase text-[var(--muted)]">Header Preview</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((option) => (
                <span
                  className="border border-[var(--line)] px-2 py-1"
                  key={`${option.letter}-${option.label}`}
                >
                  {option.letter}: {option.label || "(blank)"}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <details className="border border-[var(--line)] bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Advanced: enter columns manually
        </summary>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Manual values accept a header name, column letter, or column number.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Department Column", "departmentNameColumn"],
            ["Department Email Column", "departmentEmailColumn"],
            ["Department Head Name Column", "departmentHeadNameColumn"],
            ["Department Head Email Column", "departmentHeadEmailColumn"],
            ["Department Escalation Name Column", "escalationNameColumn"],
            ["Department Escalation Email Column", "escalationEmailColumn"],
          ].map(([label, name]) => (
            <label
              className="text-xs font-semibold uppercase text-[var(--muted)]"
              key={name}
            >
              {label}
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                onChange={(event) => updateMapping(name as MappingKey, event.target.value)}
                placeholder="Header, A, or 1"
                value={mapping[name as MappingKey]}
              />
            </label>
          ))}
        </div>
      </details>
    </>
  );
}
