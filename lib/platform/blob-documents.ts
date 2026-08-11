import { del, head, put } from "@vercel/blob";

type PutOptions = {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type StoredObject = {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: { contentType?: string };
};

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt. Blob Store in Vercel anlegen.");
  return token;
}

export function createBlobDocuments() {
  return {
    async put(key: string, body: ArrayBuffer | ReadableStream | Blob | string, options?: PutOptions) {
      await put(key, body, {
        access: "private",
        token: blobToken(),
        contentType: options?.httpMetadata?.contentType,
        addRandomSuffix: false,
      });
    },
    async get(key: string): Promise<StoredObject | null> {
      try {
        const meta = await head(key, { token: blobToken() });
        const response = await fetch(meta.url);
        if (!response.ok || !response.body) return null;
        return {
          body: response.body,
          httpMetadata: { contentType: meta.contentType || "application/octet-stream" },
        };
      } catch {
        return null;
      }
    },
    async delete(key: string) {
      await del(key, { token: blobToken() });
    },
  };
}

export type DocumentsStore = ReturnType<typeof createBlobDocuments>;
