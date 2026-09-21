import { z } from "zod";

/**
 * Fila de jobs compartilhada (tabela `jobs` no PostgreSQL, consumida com
 * `SELECT ... FOR UPDATE SKIP LOCKED`) — ver seção 3.1 e 6.
 * Tipos de job processados pelo worker Python (workers/media).
 */
export const JobTypeSchema = z.enum([
  "validate_video",
  "backup_to_drive",
  "restore_from_drive",
  "archive_local_file",
  "expire_campaign",
]);

export type JobType = z.infer<typeof JobTypeSchema>;

export const JobStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobPayloadSchema = z.object({
  type: JobTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export type JobPayload = z.infer<typeof JobPayloadSchema>;

/**
 * Payload do job `validate_video` — seção 2.4/7: apps/web enfileira este job
 * logo após subir o arquivo no MinIO; o worker Python (workers/media) baixa
 * pela `storageKey`, roda ffprobe/sha256 e publica o anúncio.
 */
export const ValidateVideoPayloadSchema = z.object({
  adId: z.string().uuid(),
  storageKey: z.string(),
});

export type ValidateVideoPayload = z.infer<typeof ValidateVideoPayloadSchema>;

/** Limite de upload de anúncios (seção 2.4) — compartilhado entre cliente e servidor. */
export const MAX_AD_UPLOAD_SIZE_MB = 30;
export const MAX_AD_UPLOAD_SIZE_BYTES = MAX_AD_UPLOAD_SIZE_MB * 1024 * 1024;
export const ALLOWED_AD_MIME_TYPES = ["video/mp4"] as const;
