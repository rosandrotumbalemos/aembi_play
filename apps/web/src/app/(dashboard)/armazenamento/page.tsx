import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { ads, jobs } from "@aembi-play/database";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { AlertTriangle, Cloud, CloudUpload, HardDrive } from "lucide-react";

/**
 * Tipos de job do worker Python relacionados ao ciclo de vida do
 * armazenamento (seção 7 do briefing) — os únicos que esta página lista em
 * "Atividade recente". `validate_video` e `expire_campaign` não entram: não
 * têm relação com MinIO/Drive.
 */
const STORAGE_JOB_TYPES = ["backup_to_drive", "restore_from_drive", "archive_local_file"] as const;
type StorageJobType = (typeof STORAGE_JOB_TYPES)[number];

const JOB_TYPE_LABEL: Record<StorageJobType, string> = {
  backup_to_drive: "Backup no Drive",
  restore_from_drive: "Restauração do Drive",
  archive_local_file: "Arquivamento local",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  processing: "Em processamento",
  completed: "Concluído",
  failed: "Falhou",
};

// Mesma paleta de 3 cores usada em telas/status.ts e histórico/labels.ts:
// default = bom, secondary = neutro/em andamento, destructive = precisa de atenção.
const JOB_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

type StorageJobRow = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function getPageData() {
  try {
    const localQuotaMb = Number(process.env.STORAGE_LOCAL_QUOTA_MB ?? "1024");

    const [usageRows, tierCountRows, pendingBackupRows, recentJobs] = await Promise.all([
      // ::int é seguro aqui — a cota local é de ~1 GB, bem dentro do range
      // de um inteiro de 32 bits, e evita o driver devolver a soma como
      // string (comportamento padrão do postgres.js para agregações bigint).
      db
        .select({ totalBytes: sql<number>`coalesce(sum(${ads.sizeBytes}), 0)::int` })
        .from(ads)
        .where(eq(ads.storageTier, "local")),
      db
        .select({ tier: ads.storageTier, count: sql<number>`count(*)::int` })
        .from(ads)
        .groupBy(ads.storageTier),
      // "Pendente de backup" = publicado, ainda em local, sem drive_file_id
      // — mesmo critério de handle_validate_video (só enfileira o backup
      // depois de validar) e do que handle_archive_local_file exige antes
      // de arquivar (nunca arquiva sem backup confirmado).
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ads)
        .where(
          and(eq(ads.storageTier, "local"), eq(ads.status, "publicado"), isNull(ads.driveFileId)),
        ),
      db
        .select({
          id: jobs.id,
          type: jobs.type,
          status: jobs.status,
          payload: jobs.payload,
          lastError: jobs.lastError,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt,
        })
        .from(jobs)
        .where(inArray(jobs.type, [...STORAGE_JOB_TYPES]))
        .orderBy(desc(jobs.updatedAt))
        .limit(20),
    ]);

    // Os jobs só guardam o adId no payload — busca os títulos numa segunda
    // consulta em vez de um JOIN, já que payload é jsonb genérico (mesmo
    // formato usado pelo worker Python, que não tem FK pra ads no nível do
    // job).
    const adIds = [
      ...new Set(
        recentJobs
          .map((job) => (job.payload as { adId?: string } | null)?.adId)
          .filter((adId): adId is string => Boolean(adId)),
      ),
    ];
    const adTitleById =
      adIds.length > 0
        ? Object.fromEntries(
            (
              await db
                .select({ id: ads.id, title: ads.title })
                .from(ads)
                .where(inArray(ads.id, adIds))
            ).map((ad) => [ad.id, ad.title] as const),
          )
        : {};

    const jobsWithAdTitle = (recentJobs as StorageJobRow[]).map((job) => ({
      ...job,
      adTitle: adTitleById[(job.payload as { adId?: string } | null)?.adId ?? ""] ?? null,
    }));

    const tierCounts = Object.fromEntries(tierCountRows.map((row) => [row.tier, row.count]));
    const lastCompletedBackup =
      jobsWithAdTitle.find((job) => job.type === "backup_to_drive" && job.status === "completed") ??
      null;
    const lastFailedBackup =
      jobsWithAdTitle.find((job) => job.type === "backup_to_drive" && job.status === "failed") ??
      null;

    return {
      dbAvailable: true as const,
      localQuotaMb,
      localUsedBytes: usageRows[0]?.totalBytes ?? 0,
      localCount: tierCounts.local ?? 0,
      driveCount: tierCounts.drive ?? 0,
      pendingBackupCount: pendingBackupRows[0]?.count ?? 0,
      jobs: jobsWithAdTitle,
      lastCompletedBackup,
      lastFailedBackup,
    };
  } catch {
    return {
      dbAvailable: false as const,
      localQuotaMb: 1024,
      localUsedBytes: 0,
      localCount: 0,
      driveCount: 0,
      pendingBackupCount: 0,
      jobs: [] as (StorageJobRow & { adTitle: string | null })[],
      lastCompletedBackup: null,
      lastFailedBackup: null,
    };
  }
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ArmazenamentoPage() {
  const data = await getPageData();

  const usedMb = data.localUsedBytes / (1024 * 1024);
  const usagePercent = data.localQuotaMb > 0 ? Math.min(100, (usedMb / data.localQuotaMb) * 100) : 0;
  const isNearQuota = usagePercent >= 80;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
          Armazenamento/Drive
        </h1>
        <p className="text-sm text-muted-foreground">
          Uso do MinIO local (cota de {data.localQuotaMb} MB) e status do backup no Google Drive —
          ciclo de vida do vídeo descrito na seção 7 do briefing.
        </p>
      </div>

      {!data.dbAvailable ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Banco de dados não conectado</CardTitle>
            <CardDescription>
              Rode <code className="font-mono">docker compose up -d</code> e{" "}
              <code className="font-mono">pnpm db:generate &amp;&amp; pnpm db:migrate</code> para ver
              dados reais aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Uso do MinIO local
              </CardTitle>
              <HardDrive className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">{formatBytes(data.localUsedBytes)}</span>
                <span className="text-sm text-muted-foreground">de {data.localQuotaMb} MB</span>
              </div>
              <Progress
                value={usagePercent}
                className={isNearQuota ? "[&_[data-slot=progress-indicator]]:bg-destructive" : ""}
              />
              {isNearQuota && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  Perto da cota — o arquivamento diário (seção 7.4) libera espaço dos anúncios com
                  mais de 7 dias sem campanha ativa.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Soma o tamanho dos vídeos com <code className="font-mono">storage_tier = local</code>
                ; miniaturas não entram nessa conta (peso desprezível).
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Anúncios no MinIO local
                </CardTitle>
                <HardDrive className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.localCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Anúncios arquivados no Drive
                </CardTitle>
                <Cloud className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.driveCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Backups pendentes
                </CardTitle>
                <CloudUpload className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold ${data.pendingBackupCount > 0 ? "text-destructive" : ""}`}
                >
                  {data.pendingBackupCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  Publicados, ainda sem <code className="font-mono">drive_file_id</code>.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status do último backup</CardTitle>
              <CardDescription>
                Disparado automaticamente pelo worker logo após cada vídeo ser validado (seção 7.3).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {data.lastCompletedBackup ? (
                <p>
                  <Badge variant="default">Concluído</Badge>{" "}
                  <span className="font-medium">{data.lastCompletedBackup.adTitle ?? "Anúncio"}</span>{" "}
                  <span className="text-muted-foreground">
                    em {formatDateTime(data.lastCompletedBackup.updatedAt)}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">Nenhum backup concluído ainda.</p>
              )}
              {data.lastFailedBackup && (
                <p>
                  <Badge variant="destructive">Falhou</Badge>{" "}
                  <span className="font-medium">{data.lastFailedBackup.adTitle ?? "Anúncio"}</span>{" "}
                  <span className="text-muted-foreground">
                    em {formatDateTime(data.lastFailedBackup.updatedAt)}
                    {data.lastFailedBackup.lastError ? ` — ${data.lastFailedBackup.lastError}` : ""}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividade recente</CardTitle>
              <CardDescription>
                Últimos 20 jobs de backup, restauração e arquivamento processados pelo worker.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Anúncio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{JOB_TYPE_LABEL[job.type as StorageJobType] ?? job.type}</TableCell>
                        <TableCell>{job.adTitle ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={JOB_STATUS_VARIANT[job.status] ?? "secondary"}>
                            {JOB_STATUS_LABEL[job.status] ?? job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(job.updatedAt)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {job.lastError ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
