/**
 * Exporta os contratos Zod como JSON Schema, para geração dos modelos
 * Pydantic usados pelo worker Python via `datamodel-code-generator`
 * (ver PROJECT_BRIEF.md seção 3.1).
 *
 * Uso:
 *   pnpm --filter @aembi-play/shared schema:export
 *   datamodel-codegen --input packages/shared/dist/json-schema \
 *     --input-file-type jsonschema --output workers/media/src/schemas
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  PlayerManifestSchema,
  RegisterDeviceResponseSchema,
  HeartbeatPayloadSchema,
  PlayLogBatchSchema,
  JobPayloadSchema,
  ValidateVideoPayloadSchema,
} from "../src/index";

const outDir = resolve(import.meta.dirname, "..", "dist", "json-schema");
mkdirSync(outDir, { recursive: true });

const schemas: Record<string, unknown> = {
  PlayerManifest: PlayerManifestSchema,
  RegisterDeviceResponse: RegisterDeviceResponseSchema,
  HeartbeatPayload: HeartbeatPayloadSchema,
  PlayLogBatch: PlayLogBatchSchema,
  JobPayload: JobPayloadSchema,
  ValidateVideoPayload: ValidateVideoPayloadSchema,
};

for (const [name, schema] of Object.entries(schemas)) {
  const jsonSchema = zodToJsonSchema(schema as never, name);
  writeFileSync(
    resolve(outDir, `${name}.json`),
    JSON.stringify(jsonSchema, null, 2),
  );
  console.log(`✓ ${name}.json`);
}
