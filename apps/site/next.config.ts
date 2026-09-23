import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Este app faz parte de um monorepo — o .env fica na raiz (../../.env), não
// em apps/site, e o Next.js só carrega .env do próprio diretório do app por
// padrão.
loadEnv({ path: path.resolve(import.meta.dirname, "../../.env") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
