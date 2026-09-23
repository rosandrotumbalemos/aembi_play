import { FileVideo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { ads, advertisers, categories } from "@aembi-play/database";
import { desc, eq, sql } from "drizzle-orm";
import { AdPreviewTrigger } from "./ad-preview-dialog";
import { NewAdDialog } from "./new-ad-dialog";

type JobInfo = { status: string; lastError: string | null };

async function getPageData() {
  try {
    const [adRows, advertiserRows, categoryRows, jobRows] = await Promise.all([
      db
        .select({
          id: ads.id,
          title: ads.title,
          description: ads.description,
          status: ads.status,
          sizeBytes: ads.sizeBytes,
          durationSeconds: ads.durationSeconds,
          thumbnailKey: ads.thumbnailKey,
          videoCodec: ads.videoCodec,
          audioCodec: ads.audioCodec,
          createdAt: ads.createdAt,
          advertiserName: advertisers.name,
          categoryName: categories.name,
        })
        .from(ads)
        .leftJoin(advertisers, eq(ads.advertiserId, advertisers.id))
        .leftJoin(categories, eq(ads.categoryId, categories.id))
        .orderBy(desc(ads.createdAt)),
      db.select({ id: advertisers.id, name: advertisers.name }).from(advertisers),
      db.select({ id: categories.id, name: categories.name }).from(categories),
      // Último job de validação por anúncio (para mostrar "Verificando..." /
      // "Falha na validação" enquanto o worker Python não publica).
      db.execute<{ ad_id: string; status: string; last_error: string | null }>(sql`
        select distinct on (payload->>'adId')
          payload->>'adId' as ad_id, status, last_error
        from jobs
        where type = 'validate_video'
        order by payload->>'adId', created_at desc
      `),
    ]);

    const jobByAdId = new Map<string, JobInfo>(
      jobRows.map((row) => [row.ad_id, { status: row.status, lastError: row.last_error }]),
    );

    return {
      adRows,
      advertiserRows,
      categoryRows,
      jobByAdId,
      dbAvailable: true as const,
    };
  } catch {
    return {
      adRows: [],
      advertiserRows: [],
      categoryRows: [],
      jobByAdId: new Map<string, JobInfo>(),
      dbAvailable: false as const,
    };
  }
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string, job: JobInfo | undefined) {
  if (status === "publicado") {
    return <Badge variant="success">Publicado</Badge>;
  }
  if (status === "arquivado") {
    return <Badge variant="secondary">Arquivado</Badge>;
  }
  if (status === "agendado") {
    return <Badge variant="warning">Agendado</Badge>;
  }
  // "rascunho" — o que aparece depende do job de validação (assíncrono).
  if (job?.status === "failed") {
    return (
      <Badge variant="destructive" title={job.lastError ?? undefined}>
        Falha na validação
      </Badge>
    );
  }
  if (job?.status === "pending" || job?.status === "processing") {
    return <Badge variant="warning">Verificando...</Badge>;
  }
  return <Badge variant="warning">Aguardando validação</Badge>;
}

export default async function AnunciosPage() {
  const { adRows, advertiserRows, categoryRows, jobByAdId, dbAvailable } = await getPageData();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            Anúncios
          </h1>
          <p className="text-sm text-muted-foreground">
            Vídeos publicitários — até 30 MB, MP4 (H.264/AAC). Validado pelo worker antes de
            publicar.
          </p>
        </div>
        <NewAdDialog advertisers={advertiserRows} categories={categoryRows} />
      </div>

      {!dbAvailable ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Banco de dados não conectado — rode as migrations para ver dados reais.
          </CardContent>
        </Card>
      ) : advertiserRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Cadastre um anunciante em{" "}
            <a href="/anunciantes" className="underline underline-offset-2">
              Anunciantes
            </a>{" "}
            antes de subir o primeiro anúncio.
          </CardContent>
        </Card>
      ) : adRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nenhum anúncio enviado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {adRows.map((ad) => (
            <Card key={ad.id} className="overflow-hidden py-0">
              <AdPreviewTrigger id={ad.id} title={ad.title}>
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
                  {ad.thumbnailKey ? (
                    // Servida por um Route Handler dinâmico (não um asset estático) — sem
                    // domínio remoto fixo pra configurar em next.config, plain <img> é mais simples.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/ads/${ad.id}/thumbnail`}
                      alt={ad.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <FileVideo className="size-8 text-muted-foreground" />
                  )}
                </div>
              </AdPreviewTrigger>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 font-medium">{ad.title}</p>
                  {statusBadge(ad.status, jobByAdId.get(ad.id))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {ad.advertiserName ?? "—"}
                  {ad.categoryName ? ` · ${ad.categoryName}` : ""}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {formatDuration(ad.durationSeconds)} · {formatSize(ad.sizeBytes)}
                  {ad.videoCodec ? ` · ${ad.videoCodec}/${ad.audioCodec ?? "—"}` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
