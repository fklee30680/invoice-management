import {
  removeBrandingLogo,
  updateBrandingSettings,
  uploadBrandingLogo,
} from "@/lib/actions";
import Image from "next/image";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fontOptions = [
  {
    label: "Arial",
    value: "Arial, Helvetica, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Segoe UI",
    value: "'Segoe UI', Arial, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Verdana",
    value: "Verdana, Geneva, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Tahoma",
    value: "Tahoma, Geneva, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Georgia",
    value: "Georgia, 'Times New Roman', serif",
  },
];

function ColorField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-[var(--muted)]">
      {label}
      <div className="mt-1 grid grid-cols-[48px_1fr] gap-2">
        <input
          className="focus-ring h-10 w-12 border border-[var(--line)] bg-white p-1"
          name={name}
          type="color"
          defaultValue={value}
        />
        <input
          className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
          aria-label={`${label} hex value`}
          defaultValue={value}
          readOnly
        />
      </div>
    </label>
  );
}

export default async function BrandingSettingsPage() {
  const data = await readData();
  const branding = data.branding;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Branding</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure the logo, display names, colors, and font used throughout the
          invoice system.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <form
            action={uploadBrandingLogo}
            className="border border-[var(--line)] bg-[var(--panel)] p-4"
          >
            <h3 className="font-semibold">Logo</h3>
            <div className="mt-4 flex min-h-28 items-center justify-center border border-dashed border-[var(--line)] bg-white p-4">
              {branding.logo ? (
                <Image
                  alt={`${branding.appTitle} logo`}
                  className="max-h-20 max-w-full object-contain"
                  height={80}
                  src="/branding/logo"
                  unoptimized
                  width={240}
                />
              ) : (
                <span className="text-sm text-[var(--muted)]">No logo uploaded</span>
              )}
            </div>
            {branding.logo ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Current file: {branding.logo.originalName}
              </p>
            ) : null}
            <input
              className="focus-ring mt-4 min-h-10 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
              name="logoFile"
              type="file"
              accept="image/*"
              required
            />
            <button className="focus-ring mt-3 w-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Upload Logo
            </button>
          </form>

          {branding.logo ? (
            <form
              action={removeBrandingLogo}
              className="border border-[var(--line)] bg-[var(--panel)] p-4"
            >
              <h3 className="font-semibold">Remove Logo</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                This removes the logo from the app header and setup preview.
              </p>
              <button className="focus-ring mt-3 w-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Remove Logo
              </button>
            </form>
          ) : null}

          <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <h3 className="font-semibold">Preview</h3>
            <div className="mt-4 border border-[var(--line)] bg-[var(--background)] p-4">
              <div className="flex items-center gap-3">
                {branding.logo ? (
                  <Image
                    alt={`${branding.appTitle} logo`}
                    className="max-h-10 max-w-28 object-contain"
                    height={40}
                    src="/branding/logo"
                    unoptimized
                    width={112}
                  />
                ) : null}
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--accent)]">
                    {branding.divisionLabel}
                  </div>
                  <div className="text-lg font-semibold">{branding.appTitle}</div>
                </div>
              </div>
              <button className="mt-4 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                Sample Button
              </button>
            </div>
          </div>
        </div>

        <form
          action={updateBrandingSettings}
          className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              App Title
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                name="appTitle"
                defaultValue={branding.appTitle}
                required
              />
            </label>
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              Division Label
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                name="divisionLabel"
                defaultValue={branding.divisionLabel}
                required
              />
            </label>
            <label className="text-xs font-semibold uppercase text-[var(--muted)] md:col-span-2">
              Font
              <select
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                name="fontFamily"
                defaultValue={branding.fontFamily}
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ColorField
              label="Primary Accent"
              name="accentColor"
              value={branding.accentColor}
            />
            <ColorField
              label="Primary Hover"
              name="accentStrongColor"
              value={branding.accentStrongColor}
            />
            <ColorField
              label="Page Background"
              name="backgroundColor"
              value={branding.backgroundColor}
            />
            <ColorField
              label="Panel Background"
              name="panelColor"
              value={branding.panelColor}
            />
            <ColorField
              label="Table Header"
              name="panelStrongColor"
              value={branding.panelStrongColor}
            />
            <ColorField
              label="Border"
              name="lineColor"
              value={branding.lineColor}
            />
            <ColorField label="Main Text" name="textColor" value={branding.textColor} />
            <ColorField
              label="Muted Text"
              name="mutedColor"
              value={branding.mutedColor}
            />
          </div>

          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Save Branding
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
