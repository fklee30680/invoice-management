"use client";

import { useMemo, useState } from "react";
import type { VendorImportSettings } from "@/lib/types";

type HeaderOption = {
  index: number;
  letter: string;
  label: string;
};

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

export function VendorImportMappingForm({
  settings,
}: {
  settings: VendorImportSettings;
}) {
  const [headerRow, setHeaderRow] = useState(settings.headerRow);
  const [headers, setHeaders] = useState<HeaderOption[]>([]);
  const [previewMessage, setPreviewMessage] = useState("");
  const [mapping, setMapping] = useState({
    vendorNumberColumn: settings.vendorNumberColumn,
    vendorNameColumn: settings.vendorNameColumn,
    vendorEmailColumn: settings.vendorEmailColumn,
    activeColumn: settings.activeColumn,
  });

  const options = useMemo(() => headers, [headers]);

  function applyHeaders(nextOptions: HeaderOption[]) {
    setHeaders(nextOptions);
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
    const formData = new FormData();
    formData.set("vendorFile", file);
    formData.set("headerRow", String(nextHeaderRow));
    setPreviewMessage("Loading header preview...");
    const response = await fetch("/api/vendor-import/preview", {
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
