import { createBlobDocuments } from "./blob-documents";
import { createLibsqlDatabase, type LibsqlDatabase } from "./libsql-d1";

type PlatformEnv = {
  DB: LibsqlDatabase;
  DOCUMENTS: ReturnType<typeof createBlobDocuments>;
};

let cached: PlatformEnv | null = null;

function databaseUrl() {
  const url = process.env.TURSO_DATABASE_URL || process.env.LOGIPAY_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL fehlt. Erstellen Sie eine Turso-Datenbank und tragen Sie URL + Token in Vercel ein.",
    );
  }
  return url;
}

function createEnv(): PlatformEnv {
  return {
    DB: createLibsqlDatabase(databaseUrl(), process.env.TURSO_AUTH_TOKEN || process.env.LOGIPAY_DATABASE_TOKEN),
    DOCUMENTS: createBlobDocuments(),
  };
}

export const env: PlatformEnv = {
  get DB() {
    cached ??= createEnv();
    return cached.DB;
  },
  get DOCUMENTS() {
    cached ??= createEnv();
    return cached.DOCUMENTS;
  },
};
