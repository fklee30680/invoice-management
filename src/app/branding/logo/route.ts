import { NextResponse } from "next/server";
import { readStoredBrandingLogo } from "@/lib/file-storage";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  const logo = data.branding.logo;

  if (!logo) {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }

  const storedLogo = await readStoredBrandingLogo(logo);
  if (!storedLogo) {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", storedLogo.mimeType);
  headers.set("Content-Length", String(storedLogo.size));
  headers.set("Cache-Control", "no-store");

  return new NextResponse("stream" in storedLogo ? storedLogo.stream : storedLogo.body, {
    headers,
  });
}
