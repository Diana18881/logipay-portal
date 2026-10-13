#!/usr/bin/env node
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const password = process.env.LOGIPAY_DEMO_PASSWORD || "LogipayLocal2026!";

function findSqlite() {
  const base = path.join(root, ".wrangler/state/v3/d1");
  if (!existsSync(base)) return null;
  const output = execSync(`find "${base}" -name "*.sqlite" ! -name "metadata.sqlite" | head -1`, { encoding: "utf8" }).trim();
  return output || null;
}

function base64FromBytes(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(value) {
  const iterations = 210000;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  return `pbkdf2_sha256$${iterations}$${base64FromBytes(salt)}$${base64FromBytes(derived)}`;
}

const sqlite = findSqlite();
if (!sqlite) {
  console.error("Keine lokale D1-Datenbank. Bitte zuerst 'npm run dev' starten.");
  process.exit(1);
}

const hash = await hashPassword(password);
const db = new DatabaseSync(sqlite);
const result = db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, must_change_password = 0 WHERE email LIKE '%@logipay.demo'").run(hash);
console.log(`Updated ${result.changes} users in ${sqlite}`);
console.log(`Passwort: ${password}`);
for (const row of db.prepare("SELECT email, password_hash FROM users WHERE email LIKE '%@logipay.demo'").all()) {
  console.log(`  ${row.email}: ${String(row.password_hash).startsWith("pbkdf2_sha256$210000$") ? "OK" : "BAD"}`);
}
