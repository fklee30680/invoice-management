import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob, put } from "@vercel/blob";
import { ensureRuntimeDirs, getUploadPath } from "./store";
import type { InvoiceFile } from "./types";

function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "invoice"}${parsed.ext || ".bin"}`;
}

export async function stageFileForProcessing(
  bytes: Buffer,
  storedName: string,
) {
  await ensureRuntimeDirs();
  const filePath = getUploadPath(storedName);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function saveInvoiceFile(input: {
  id: string;
  invoiceId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  bytes: Buffer;
}): Promise<InvoiceFile> {
  if (hasBlobStorage()) {
    const pathname = `invoices/${input.invoiceId}/${safeFileName(input.originalName)}`;
    const blob = await put(pathname, input.bytes, {
      access: "private",
      allowOverwrite: true,
      contentType: input.mimeType || "application/octet-stream",
    });

    return {
      id: input.id,
      invoiceId: input.invoiceId,
      originalName: input.originalName,
      storedName: blob.pathname,
      storageProvider: "blob",
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      blobAccess: "private",
      mimeType: blob.contentType || input.mimeType || "application/octet-stream",
      size: input.size,
      uploadedAt: input.uploadedAt,
    };
  }

  await stageFileForProcessing(input.bytes, input.storedName);

  return {
    id: input.id,
    invoiceId: input.invoiceId,
    originalName: input.originalName,
    storedName: input.storedName,
    storageProvider: "local",
    mimeType: input.mimeType || "application/octet-stream",
    size: input.size,
    uploadedAt: input.uploadedAt,
  };
}

export async function readStoredInvoiceFile(file: InvoiceFile) {
  if (file.storageProvider === "blob") {
    const blob = await getBlob(file.blobPathname || file.storedName, {
      access: file.blobAccess || "private",
    });
    if (!blob || blob.statusCode !== 200) return null;

    return {
      stream: blob.stream,
      mimeType: blob.blob.contentType || file.mimeType,
      size: blob.blob.size || file.size,
    };
  }

  const body = await readFile(getUploadPath(file.storedName));
  return {
    body,
    mimeType: file.mimeType,
    size: body.length,
  };
}
