import { createClient, type Client } from "@libsql/client";

export type D1BindValue = string | number | null | boolean | ArrayBuffer;

export class LibsqlStatement {
  readonly sql: string;
  readonly args: D1BindValue[];

  constructor(
    private readonly client: Client,
    sql: string,
    args: D1BindValue[] = [],
  ) {
    this.sql = sql;
    this.args = args;
  }

  bind(...values: D1BindValue[]) {
    return new LibsqlStatement(this.client, this.sql, values);
  }

  async run() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return {
      success: true,
      meta: {
        changes: result.rowsAffected,
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    };
  }

  async first<T = Record<string, unknown>>() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: result.rows as T[] };
  }
}

export type LibsqlDatabase = {
  prepare: (sql: string) => LibsqlStatement;
  batch: (statements: LibsqlStatement[]) => Promise<unknown>;
};

export function createLibsqlDatabase(url: string, authToken?: string): LibsqlDatabase {
  const client = createClient({ url, authToken: authToken || undefined });
  return {
    prepare(sql: string) {
      return new LibsqlStatement(client, sql);
    },
    async batch(statements: LibsqlStatement[]) {
      if (!statements.length) return [];
      return client.batch(
        statements.map((statement) => ({ sql: statement.sql, args: statement.args })),
        "write",
      );
    },
  };
}
