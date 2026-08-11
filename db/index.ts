import { env } from "@logipay/env";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error("Database binding `DB` is unavailable.");
  }

  return drizzle(env.DB as unknown as D1Database, { schema });
}
