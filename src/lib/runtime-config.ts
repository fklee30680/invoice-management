type PersistenceProvider = "postgres" | "blob" | "temporary";
type BlobAccessMode = "public" | "private";

export type PersistenceStatus = {
  records: {
    provider: PersistenceProvider;
    configured: boolean;
    variableName: string;
    issue: string;
  };
  files: {
    provider: PersistenceProvider;
    configured: boolean;
    variableName: string;
    issue: string;
  };
  isVercel: boolean;
  warning: string;
};

const DATABASE_ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
];

const BLOB_ENV_NAMES = ["BLOB_READ_WRITE_TOKEN", "VERCEL_BLOB_READ_WRITE_TOKEN"];

let databaseIssue = "";
let fileStorageIssue = "";

function firstConfiguredEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return { name, value };
  }
  return { name: "", value: "" };
}

export function getDatabaseConfig() {
  return firstConfiguredEnv(DATABASE_ENV_NAMES);
}

export function getBlobConfig() {
  return firstConfiguredEnv(BLOB_ENV_NAMES);
}

export function getBlobAccessMode(): BlobAccessMode {
  return process.env.BLOB_ACCESS === "private" ? "private" : "public";
}

export function reportDatabaseIssue(error: unknown) {
  databaseIssue = readableError(error);
}

export function clearDatabaseIssue() {
  databaseIssue = "";
}

export function reportFileStorageIssue(error: unknown) {
  fileStorageIssue = readableError(error);
}

export function clearFileStorageIssue() {
  fileStorageIssue = "";
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

export function getPersistenceStatus(): PersistenceStatus {
  const database = getDatabaseConfig();
  const blob = getBlobConfig();
  const isVercel = Boolean(process.env.VERCEL);
  const missing = [];
  const issues = [];

  if (!database.value) missing.push("database");
  if (!blob.value) missing.push("file storage");
  if (databaseIssue) issues.push("database connection failed");
  if (fileStorageIssue) issues.push("file storage failed");

  return {
    records: {
      provider: database.value ? "postgres" : "temporary",
      configured: Boolean(database.value),
      variableName: database.name || DATABASE_ENV_NAMES[0],
      issue: databaseIssue,
    },
    files: {
      provider: blob.value ? "blob" : "temporary",
      configured: Boolean(blob.value),
      variableName: blob.name || BLOB_ENV_NAMES[0],
      issue: fileStorageIssue,
    },
    isVercel,
    warning:
      isVercel && (missing.length || issues.length)
        ? `Vercel storage needs attention: ${[...missing, ...issues].join(", ")}.`
        : "",
  };
}
