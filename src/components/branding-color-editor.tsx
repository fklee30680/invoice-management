"use client";

import { useMemo, useState } from "react";
import {
  hexToRgb,
  normalizeHex,
  rgbToHex,
  type RgbColor,
} from "@/lib/color-utils";
import type { BrandingSettings } from "@/lib/types";

type BrandingColorName =
  | "accentColor"
  | "accentStrongColor"
  | "backgroundColor"
  | "panelColor"
  | "panelStrongColor"
  | "textColor"
  | "mutedColor"
  | "lineColor";

type BrandingColors = Pick<BrandingSettings, BrandingColorName>;

const colorFields: {
  description: string;
  label: string;
  name: BrandingColorName;
}[] = [
  {
    name: "accentColor",
    label: "Accent Color",
    description: "Primary buttons, links, and highlights.",
  },
  {
    name: "accentStrongColor",
    label: "Accent Hover Color",
    description: "Hover and stronger accent states.",
  },
  {
    name: "backgroundColor",
    label: "Background Color",
    description: "Main page background.",
  },
  {
    name: "panelColor",
    label: "Panel Color",
    description: "Cards, forms, and panels.",
  },
  {
    name: "panelStrongColor",
    label: "Table Header Color",
    description: "Table headers and stronger panel surfaces.",
  },
  {
    name: "textColor",
    label: "Text Color",
    description: "Primary text throughout the app.",
  },
  {
    name: "mutedColor",
    label: "Muted Text Color",
    description: "Secondary labels and helper text.",
  },
  {
    name: "lineColor",
    label: "Border Color",
    description: "Borders, dividers, and table lines.",
  },
];

function rgbStrings(hex: string) {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  return {
    r: String(rgb.r),
    g: String(rgb.g),
    b: String(rgb.b),
  };
}

function parseRgb(values: { r: string; g: string; b: string }): RgbColor | null {
  const rgb = {
    r: Number(values.r),
    g: Number(values.g),
    b: Number(values.b),
  };
  const wholeNumbers = [values.r, values.g, values.b].every((value) =>
    /^\d+$/.test(value.trim()),
  );
  if (!wholeNumbers) return null;
  return rgbToHex(rgb) ? rgb : null;
}

function BrandingColorRow({
  description,
  label,
  name,
  value,
  onApply,
}: {
  description: string;
  label: string;
  name: BrandingColorName;
  value: string;
  onApply: (name: BrandingColorName, value: string) => void;
}) {
  const [currentHex, setCurrentHex] = useState(normalizeHex(value) || "#000000");
  const [hexInput, setHexInput] = useState(currentHex);
  const [rgbInput, setRgbInput] = useState(rgbStrings(currentHex));
  const [errorMessage, setErrorMessage] = useState("");
  const [dirtySource, setDirtySource] = useState<"hex" | "rgb" | null>(null);
  const errorId = `${name}-color-error`;

  function commitHex(nextHex: string) {
    setCurrentHex(nextHex);
    setHexInput(nextHex);
    setRgbInput(rgbStrings(nextHex));
    setDirtySource(null);
    setErrorMessage("");
    onApply(name, nextHex);
  }

  function applyHex() {
    const normalized = normalizeHex(hexInput);
    if (!normalized) {
      setErrorMessage("Enter a valid hex color, such as #0F766E.");
      return;
    }
    commitHex(normalized);
  }

  function applyRgb() {
    const rgb = parseRgb(rgbInput);
    if (!rgb) {
      setErrorMessage("RGB values must be between 0 and 255.");
      return;
    }
    const hex = rgbToHex(rgb);
    if (!hex) {
      setErrorMessage("RGB values must be between 0 and 255.");
      return;
    }
    commitHex(hex);
  }

  function applyPending() {
    if (dirtySource === "rgb") {
      applyRgb();
      return;
    }
    applyHex();
  }

  function applyOnBlur() {
    if (dirtySource) applyPending();
  }

  function handleEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyPending();
  }

  return (
    <section className="border border-[var(--line)] bg-white p-3">
      <input name={name} type="hidden" value={currentHex} />
      <div className="grid gap-3 lg:grid-cols-[1fr_72px_140px_180px_auto] lg:items-end">
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{label}</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          <div
            className="mt-2 h-5 w-full border border-[var(--line)]"
            style={{ backgroundColor: currentHex }}
          />
        </div>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Picker
          <input
            aria-label={`${label} color picker`}
            className="focus-ring mt-1 h-10 w-full border border-[var(--line)] bg-white p-1"
            onChange={(event) => commitHex(event.currentTarget.value)}
            type="color"
            value={currentHex}
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Hex
          <input
            aria-describedby={errorMessage ? errorId : undefined}
            aria-invalid={Boolean(errorMessage)}
            aria-label={`${label} hex value`}
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            onBlur={applyOnBlur}
            onChange={(event) => {
              setHexInput(event.currentTarget.value);
              setDirtySource("hex");
            }}
            onKeyDown={handleEnter}
            value={hexInput}
          />
        </label>
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="text-xs font-semibold uppercase text-[var(--muted)]">
            RGB
          </legend>
          {(["r", "g", "b"] as const).map((channel) => (
            <label
              className="text-xs font-semibold uppercase text-[var(--muted)]"
              key={channel}
            >
              {channel.toUpperCase()}
              <input
                aria-describedby={errorMessage ? errorId : undefined}
                aria-invalid={Boolean(errorMessage)}
                aria-label={`${label} ${channel.toUpperCase()} value`}
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                inputMode="numeric"
                max={255}
                min={0}
                onBlur={applyOnBlur}
                onChange={(event) => {
                  setRgbInput((current) => ({
                    ...current,
                    [channel]: event.currentTarget.value,
                  }));
                  setDirtySource("rgb");
                }}
                onKeyDown={handleEnter}
                type="number"
                value={rgbInput[channel]}
              />
            </label>
          ))}
        </fieldset>
        <button
          className="focus-ring min-h-10 border border-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
          onClick={applyPending}
          type="button"
        >
          Update
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-2 text-xs font-semibold text-red-700" id={errorId}>
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

export function BrandingColorEditor({ colors }: { colors: BrandingColors }) {
  const initialColors = useMemo(
    () =>
      colorFields.reduce<BrandingColors>((result, field) => {
        result[field.name] = normalizeHex(colors[field.name]) || "#000000";
        return result;
      }, {} as BrandingColors),
    [colors],
  );
  const [previewColors, setPreviewColors] = useState(initialColors);

  function applyPreviewColor(name: BrandingColorName, value: string) {
    setPreviewColors((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Brand Colors</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Edit each color using Hex, RGB, or the color picker. Click Update,
            press Enter, or leave a valid field to update the preview.
          </p>
        </div>
        <div className="grid gap-3">
          {colorFields.map((field) => (
            <BrandingColorRow
              description={field.description}
              key={field.name}
              label={field.label}
              name={field.name}
              onApply={applyPreviewColor}
              value={colors[field.name]}
            />
          ))}
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-4">
        <h3 className="font-semibold">Preview</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Preview updates here before saving. Click Save Branding to apply
          changes.
        </p>
        <div
          className="mt-4 border p-4"
          style={{
            backgroundColor: previewColors.backgroundColor,
            borderColor: previewColors.lineColor,
            color: previewColors.textColor,
          }}
        >
          <div
            className="border p-3"
            style={{
              backgroundColor: previewColors.panelColor,
              borderColor: previewColors.lineColor,
            }}
          >
            <div
              className="border px-3 py-2 text-sm font-semibold"
              style={{
                backgroundColor: previewColors.panelStrongColor,
                borderColor: previewColors.lineColor,
              }}
            >
              Sample Table Header
            </div>
            <p className="mt-3 text-sm font-semibold">Sample invoice card</p>
            <p className="mt-1 text-sm" style={{ color: previewColors.mutedColor }}>
              Muted helper text and secondary labels use the muted text color.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: previewColors.accentColor }}
                type="button"
              >
                Sample Button
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: previewColors.accentStrongColor }}
                type="button"
              >
                Hover Color
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
