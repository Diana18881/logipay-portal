import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

type PutOptions = {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type StoredObject = {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: { contentType?: string };
};

export type DocumentsStore = {
  put(key: string, body: ArrayBuffer | ReadableStream | Blob | string, options?: PutOptions): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
};

function blobDocuments(token: string): DocumentsStore {
  return {
    async put(key, body, options) {
      await put(key, body, { access: "private", token, contentType: options?.httpMetadata?.contentType, addRandomSuffix: false, allowOverwrite: true });
    },
    async get(key) {
      try {
        const result = await get(key, { access: "private", token });
        if (!result || result.statusCode !== 200) return null;
        return { body: result.stream, httpMetadata: { contentType: result.blob.contentType || "application/octet-stream" } };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await del(key, { token });
    },
    async deletePrefix(prefix) {
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, token, limit: 1000 });
        if (page.blobs.length) await del(page.blobs.map((blob) => blob.url), { token });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    },
  };
}

/** Local development without a Blob token: files live under .data/blobs. */
function fileDocuments(root: string): DocumentsStore {
  const resolve = (key: string) => {
    const target = path.resolve(root, key);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error("Ungültiger Dateipfad");
    return target;
  };
  return {
    async put(key, body, options) {
      const target = resolve(key);
      await mkdir(path.dirname(target), { recursive: true });
      const bytes = typeof body === "string" ? Buffer.from(body) : Buffer.from(await new Response(body).arrayBuffer());
      await writeFile(target, bytes);
      await writeFile(`${target}.type`, options?.httpMetadata?.contentType || "application/octet-stream");
    },
    async get(key) {
      try {
        const target = resolve(key);
        const bytes = await readFile(target);
        const contentType = await readFile(`${target}.type`, "utf8").catch(() => "application/octet-stream");
        return { body: new Response(bytes).body, httpMetadata: { contentType } };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const target = resolve(key);
      await rm(target, { force: true });
      await rm(`${target}.type`, { force: true });
    },
    async deletePrefix(prefix) {
      await rm(resolve(prefix), { recursive: true, force: true });
    },
  };
}

export function createBlobDocuments(): DocumentsStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  // Only deployments use the cloud store; local development never touches production files,
  // even when a pulled .env.local contains the token (opt in with LOGIPAY_USE_BLOB=1).
  const onVercel = Boolean(process.env.VERCEL_ENV) || process.env.LOGIPAY_USE_BLOB === "1";
  if (token && onVercel) return blobDocuments(token);
  if (process.env.VERCEL_ENV) throw new Error("BLOB_READ_WRITE_TOKEN fehlt. Blob Store in Vercel anlegen.");
  return fileDocuments(path.resolve(process.env.LOGIPAY_DATA_DIR || ".data", "blobs"));
}
