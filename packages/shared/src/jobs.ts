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
