import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cliente Drizzle compartilhado por apps/web. O worker Python (workers/media)
 * lê e escreve nas mesmas tabelas via SQLAlchemy, sem passar por este
 * cliente — ver PROJECT_BRIEF.md seção 3.1.
 */
export function createDbClient(connectionString: string) {
  const queryClient = postgres(connectionString);
  return drizzle(queryClient, { schema });
}

export type Database = ReturnType<typeof createDbClient>;
