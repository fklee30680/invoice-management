import {
  removeBrandingLogo,
  updateBrandingSettings,
  uploadBrandingLogo,
} from "@/lib/actions";
import { BrandingColorEditor } from "@/components/branding-color-editor";
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

          <BrandingColorEditor
            colors={{
              accentColor: branding.accentColor,
              accentStrongColor: branding.accentStrongColor,
              backgroundColor: branding.backgroundColor,
              panelColor: branding.panelColor,
              panelStrongColor: branding.panelStrongColor,
              textColor: branding.textColor,
              mutedColor: branding.mutedColor,
              lineColor: branding.lineColor,
            }}
          />

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
