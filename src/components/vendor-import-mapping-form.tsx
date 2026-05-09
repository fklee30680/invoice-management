"use client";

import { useMemo, useState } from "react";
import type { VendorImportSettings } from "@/lib/types";

type HeaderOption = {
  index: number;
  letter: string;
  header: string;
};

function columnLetter(index: number) {
  let value = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function resolveSavedValue(options: HeaderOption[], saved: string) {
  const trimmed = saved.trim();
  if (!trimmed) return "";
  const normalized = normalizeHeader(trimmed);
  const headerMatch = options.find((option) => normalizeHeader(option.header) === normalized);
  if (headerMatch) return headerMatch.header;
  const letterMatch = options.find((option) => option.letter.toLowerCase() === trimmed.toLowerCase());
  if (letterMatch) return letterMatch.header;
  if (/^\d+$/.test(trimmed)) {
    const numberMatch = options[Number(trimmed) - 1];
    if (numberMatch) return numberMatch.header;
  }
  return trimmed;
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
  name: keyof VendorImportSettings;
  onChange: (name: keyof VendorImportSettings, value: string) => void;
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
        <option value="">Select column</option>
        {options.map((option) => (
          <option key={`${option.letter}-${option.header}`} value={option.header}>
            {option.header || "(blank header)"} - Column {option.letter}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VendorImportMappingForm({
  settings,
}: {
  settings: VendorImportSettings;
}) {
  const [headerRow, setHeaderRow] = useState(settings.headerRow);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewMessage, setPreviewMessage] = useState("");
  const [mapping, setMapping] = useState({
    vendorNumberColumn: settings.vendorNumberColumn,
    vendorNameColumn: settings.vendorNameColumn,
    vendorEmailColumn: settings.vendorEmailColumn,
    activeColumn: settings.activeColumn,
  });

  const options = useMemo(
    () =>
      headers.map((header, index) => ({
        index,
        letter: columnLetter(index),
        header,
      })),
    [headers],
  );

  function applyHeaders(nextHeaders: string[]) {
    const nextOptions = nextHeaders.map((header, index) => ({
      index,
      letter: columnLetter(index),
      header,
    }));
    setHeaders(nextHeaders);
    setMapping({
      vendorNumberColumn: resolveSavedValue(nextOptions, settings.vendorNumberColumn),
      vendorNameColumn: resolveSavedValue(nextOptions, settings.vendorNameColumn),
      vendorEmailColumn: resolveSavedValue(nextOptions, settings.vendorEmailColumn),
      activeColumn: resolveSavedValue(nextOptions, settings.activeColumn),
    });
  }

  async function previewFile(file: File | undefined, nextHeaderRow = headerRow) {
    if (!file) {
      setHeaders([]);
      setPreviewMessage("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setHeaders([]);
      setPreviewMessage("Header preview is available for CSV files. Use manual column entry for Excel files.");
      return;
    }
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseCsvLine);
    const header = rows[Math.max(nextHeaderRow - 1, 0)];
    if (!header) {
      setHeaders([]);
      setPreviewMessage(`Header row ${nextHeaderRow} was not found in the file.`);
      return;
    }
    setPreviewMessage("");
    applyHeaders(header);
  }

  function updateMapping(name: keyof VendorImportSettings, value: string) {
    if (
      name === "vendorNumberColumn" ||
      name === "vendorNameColumn" ||
      name === "vendorEmailColumn" ||
      name === "activeColumn"
    ) {
      setMapping((current) => ({ ...current, [name]: value }));
    }
  }

  return (
    <>
      <section>
        <h3 className="text-sm font-semibold">File And Header</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Vendor File
            <input
              accept=".csv,.xlsx,.xls"
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
              name="vendorFile"
              onChange={(event) => previewFile(event.target.files?.[0])}
              required
              type="file"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Header Row Number
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              min={1}
              name="headerRow"
              onChange={(event) => {
                const next = Math.max(Number(event.target.value) || 1, 1);
                setHeaderRow(next);
                const fileInput = event.currentTarget
                  .closest("form")
                  ?.querySelector<HTMLInputElement>('input[name="vendorFile"]');
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
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MappingSelect
            label="Vendor Number Column"
            name="vendorNumberColumn"
            onChange={updateMapping}
            options={options}
            required
            value={mapping.vendorNumberColumn}
          />
          <MappingSelect
            label="Vendor Name Column"
            name="vendorNameColumn"
            onChange={updateMapping}
            options={options}
            required
            value={mapping.vendorNameColumn}
          />
          <MappingSelect
            label="Vendor Email Column"
            name="vendorEmailColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.vendorEmailColumn}
          />
          <MappingSelect
            label="Active Column"
            name="activeColumn"
            onChange={updateMapping}
            options={options}
            value={mapping.activeColumn}
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
                  key={`${option.letter}-${option.header}`}
                >
                  {option.letter}: {option.header || "(blank)"}
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
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Vendor Number Column", "vendorNumberColumn"],
            ["Vendor Name Column", "vendorNameColumn"],
            ["Vendor Email Column", "vendorEmailColumn"],
            ["Active Column", "activeColumn"],
          ].map(([label, name]) => (
            <label
              className="text-xs font-semibold uppercase text-[var(--muted)]"
              key={name}
            >
              {label}
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                onChange={(event) => updateMapping(name as keyof VendorImportSettings, event.target.value)}
                placeholder="Header, A, or 1"
                value={mapping[name as keyof typeof mapping]}
              />
            </label>
          ))}
        </div>
      </details>
    </>
  );
}
