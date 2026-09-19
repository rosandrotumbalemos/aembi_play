import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// As migrations do banco inteiro (TS e Python) vivem só aqui — ver
// PROJECT_BRIEF.md seção 3.1: "migrations somente no Drizzle".
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://aembi:aembi_dev_password@localhost:5432/aembi_play",
  },
  strict: true,
  verbose: true,
});
