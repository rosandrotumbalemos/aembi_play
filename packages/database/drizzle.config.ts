import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// drizzle-kit empacota este arquivo com esbuild em formato CJS antes de
// rodar, então "import.meta.dirname" fica vazio aqui (só existe em ESM) —
// usamos process.cwd() em vez disso. O pnpm/turbo sempre rodam este script
// com cwd em packages/database, então isso é estável.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

// As migrations do banco inteiro (TS e Python) vivem só aqui — ver
// PROJECT_BRIEF.md seção 3.1: "migrations somente no Drizzle".
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://aembi:aembi_dev_password@localhost:55432/aembi_play",
  },
  strict: true,
  verbose: true,
});
