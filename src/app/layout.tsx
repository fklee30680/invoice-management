import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { readData } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice Management",
  description: "AP invoice routing and review workflow",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = await readData();
  const branding = data.branding;
  const brandStyle = {
    "--background": branding.backgroundColor,
    "--foreground": branding.textColor,
    "--muted": branding.mutedColor,
    "--panel": branding.panelColor,
    "--panel-strong": branding.panelStrongColor,
    "--line": branding.lineColor,
    "--accent": branding.accentColor,
    "--accent-strong": branding.accentStrongColor,
    "--brand-font": branding.fontFamily,
  } as CSSProperties;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={brandStyle}>
        {children}
      </body>
    </html>
  );
}
