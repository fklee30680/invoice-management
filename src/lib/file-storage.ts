import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get as getBlob, put } from "@vercel/blob";
import {
  clearFileStorageIssue,
  getBlobAccessMode,
  getBlobConfig,
  reportFileStorageIssue,
} from "./runtime-config";
import { ensureRuntimeDirs, getUploadPath } from "./store";
import type { BrandingLogo, InvoiceFile } from "./types";

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
  const blobConfig = getBlobConfig();
  const blobAccess = getBlobAccessMode();
  if (blobConfig.value) {
    try {
      const pathname = `invoices/${input.invoiceId}/${safeFileName(input.originalName)}`;
      const blob = await put(pathname, input.bytes, {
        access: blobAccess,
        allowOverwrite: true,
        contentType: input.mimeType || "application/octet-stream",
        token: blobConfig.value,
      });
      clearFileStorageIssue();

      return {
        id: input.id,
        invoiceId: input.invoiceId,
        originalName: input.originalName,
        storedName: blob.pathname,
        storageProvider: "blob",
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        blobAccess,
        mimeType: blob.contentType || input.mimeType || "application/octet-stream",
        size: input.size,
        uploadedAt: input.uploadedAt,
      };
    } catch (error) {
      reportFileStorageIssue(error);
      console.error("[storage:blob] upload failed", error);
      if (process.env.VERCEL) {
        throw new Error("Blob upload failed.");
      }
    }
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

export async function saveBrandingLogo(input: {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  bytes: Buffer;
}): Promise<BrandingLogo> {
  const blobConfig = getBlobConfig();
  const blobAccess = getBlobAccessMode();
  if (blobConfig.value) {
    try {
      const pathname = `branding/${safeFileName(input.storedName)}`;
      const blob = await put(pathname, input.bytes, {
        access: blobAccess,
        allowOverwrite: true,
        contentType: input.mimeType || "application/octet-stream",
        token: blobConfig.value,
      });
      clearFileStorageIssue();

      return {
        originalName: input.originalName,
        storedName: blob.pathname,
        storageProvider: "blob",
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        blobAccess,
        mimeType: blob.contentType || input.mimeType || "application/octet-stream",
        size: input.size,
        uploadedAt: input.uploadedAt,
      };
    } catch (error) {
      reportFileStorageIssue(error);
      console.error("[storage:blob] branding upload failed", error);
      if (process.env.VERCEL) {
        throw new Error("Logo upload failed.");
      }
    }
  }

  await stageFileForProcessing(input.bytes, input.storedName);

  return {
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
    try {
      const blobConfig = getBlobConfig();
      const blob = await getBlob(file.blobPathname || file.blobUrl || file.storedName, {
        access: file.blobAccess || "private",
        token: blobConfig.value || undefined,
      });
      if (!blob || blob.statusCode !== 200) return null;

      clearFileStorageIssue();
      return {
        stream: blob.stream,
        mimeType: blob.blob.contentType || file.mimeType,
        size: blob.blob.size || file.size,
      };
    } catch (error) {
      reportFileStorageIssue(error);
      console.error("[storage:blob] read failed", error);
      return null;
    }
  }

  try {
    const body = await readFile(getUploadPath(file.storedName));
    return {
      body,
      mimeType: file.mimeType,
      size: body.length,
    };
  } catch {
    return null;
  }
}

export async function readStoredBrandingLogo(file: BrandingLogo) {
  if (file.storageProvider === "blob") {
    try {
      const blobConfig = getBlobConfig();
      const blob = await getBlob(file.blobPathname || file.blobUrl || file.storedName, {
        access: file.blobAccess || "private",
        token: blobConfig.value || undefined,
      });
      if (!blob || blob.statusCode !== 200) return null;

      clearFileStorageIssue();
      return {
        stream: blob.stream,
        mimeType: blob.blob.contentType || file.mimeType,
        size: blob.blob.size || file.size,
      };
    } catch (error) {
      reportFileStorageIssue(error);
      console.error("[storage:blob] branding read failed", error);
      return null;
    }
  }

  try {
    const body = await readFile(getUploadPath(file.storedName));
    return {
      body,
      mimeType: file.mimeType,
      size: body.length,
    };
  } catch {
    return null;
  }
}

export async function deleteStoredInvoiceFile(file: InvoiceFile) {
  if (file.storageProvider === "blob") {
    const blobConfig = getBlobConfig();
    await del(file.blobPathname || file.blobUrl || file.storedName, {
      token: blobConfig.value || undefined,
    });
    return;
  }

  await rm(getUploadPath(file.storedName), { force: true });
}

export async function deleteStoredBrandingLogo(file: BrandingLogo) {
  if (file.storageProvider === "blob") {
    const blobConfig = getBlobConfig();
    await del(file.blobPathname || file.blobUrl || file.storedName, {
      token: blobConfig.value || undefined,
    });
    return;
  }

  await rm(getUploadPath(file.storedName), { force: true });
}
