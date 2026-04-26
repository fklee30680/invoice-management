type PersistenceProvider = "postgres" | "blob" | "temporary";

export type PersistenceStatus = {
  records: {
    provider: PersistenceProvider;
    configured: boolean;
    variableName: string;
  };
  files: {
    provider: PersistenceProvider;
    configured: boolean;
    variableName: string;
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

export function getPersistenceStatus(): PersistenceStatus {
  const database = getDatabaseConfig();
  const blob = getBlobConfig();
  const isVercel = Boolean(process.env.VERCEL);
  const missing = [];

  if (!database.value) missing.push("database");
  if (!blob.value) missing.push("file storage");

  return {
    records: {
      provider: database.value ? "postgres" : "temporary",
      configured: Boolean(database.value),
      variableName: database.name || DATABASE_ENV_NAMES[0],
    },
    files: {
      provider: blob.value ? "blob" : "temporary",
      configured: Boolean(blob.value),
      variableName: blob.name || BLOB_ENV_NAMES[0],
    },
    isVercel,
    warning:
      isVercel && missing.length
        ? `Vercel is missing persistent ${missing.join(" and ")} configuration.`
        : "",
  };
}
