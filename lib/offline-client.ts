"use client";

type StoredField = {
  name: string;
  value: string | Blob;
  fileName?: string;
};

type StoredUpload = {
  id: string;
  endpoint: string;
  fields: StoredField[];
  createdAt: string;
};

const DB_NAME = "logipay-offline";
const DB_VERSION = 1;

function openOfflineDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("uploads")) database.createObjectStore("uploads", { keyPath: "id" });
      if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline-Speicher nicht verfügbar"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Offline-Speicherfehler"));
    transaction.onabort = () => reject(transaction.error || new Error("Offline-Speicher abgebrochen"));
  });
}

export async function queueOfflineUpload(endpoint: string, formData: FormData) {
  const database = await openOfflineDatabase();
  const fields: StoredField[] = [];
  for (const [name, value] of formData.entries()) {
    if (value instanceof File) fields.push({ name, value, fileName: value.name });
    else fields.push({ name, value: String(value) });
  }
  const transaction = database.transaction("uploads", "readwrite");
  transaction.objectStore("uploads").put({
    id: crypto.randomUUID(),
    endpoint,
    fields,
    createdAt: new Date().toISOString(),
  } satisfies StoredUpload);
  await transactionDone(transaction);
  database.close();
}

async function readUploads() {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("uploads", "readonly");
  const request = transaction.objectStore("uploads").getAll();
  const uploads = await new Promise<StoredUpload[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result || []) as StoredUpload[]);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(transaction);
  database.close();
  return uploads.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function countOfflineUploads() {
  return (await readUploads()).length;
}

export async function flushOfflineUploads() {
  const uploads = await readUploads();
  let sent = 0;
  for (const upload of uploads) {
    const formData = new FormData();
    for (const field of upload.fields) {
      if (field.value instanceof Blob) formData.append(field.name, field.value, field.fileName || "upload");
      else formData.append(field.name, field.value);
    }
    try {
      const response = await fetch(upload.endpoint, { method: "POST", body: formData });
      if (!response.ok) continue;
      const database = await openOfflineDatabase();
      const transaction = database.transaction("uploads", "readwrite");
      transaction.objectStore("uploads").delete(upload.id);
      await transactionDone(transaction);
      database.close();
      sent += 1;
    } catch {
      break;
    }
  }
  return { sent, remaining: Math.max(0, uploads.length - sent) };
}

export async function savePortalSnapshot(key: string, value: unknown) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("snapshots", "readwrite");
  transaction.objectStore("snapshots").put({ key, value, updatedAt: new Date().toISOString() });
  await transactionDone(transaction);
  database.close();
}

export async function loadPortalSnapshot<T>(key: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("snapshots", "readonly");
  const request = transaction.objectStore("snapshots").get(key);
  const result = await new Promise<{ value?: T } | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as { value?: T } | undefined);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(transaction);
  database.close();
  return result?.value;
}
