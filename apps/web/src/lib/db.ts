import { createDbClient } from "@aembi-play/database";

/**
 * Cliente Drizzle único, reaproveitado entre hot-reloads em dev (evita
 * esgotar conexões do Postgres a cada refresh do Next.js).
 */
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDbClient>;
};

export const db =
  globalForDb.db ??
  createDbClient(
    process.env.DATABASE_URL ??
      "postgresql://aembi:aembi_dev_password@localhost:55432/aembi_play",
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
