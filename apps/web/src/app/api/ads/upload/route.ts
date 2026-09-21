import { db } from "@/lib/db";
import { uploadAdVideo } from "@/lib/storage";
import { ads, advertisers, jobs } from "@aembi-play/database";
import { ALLOWED_AD_MIME_TYPES, MAX_AD_UPLOAD_SIZE_BYTES } from "@aembi-play/shared";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Recebe o upload de um anúncio (arrastar-e-soltar no painel), sobe pro MinIO
 * e enfileira o job `validate_video` pro worker Python validar com ffprobe e
 * publicar — seção 2.4/7 do briefing. Usa um Route Handler (não Server
 * Action) porque o cliente acompanha o progresso via XHR (`upload.onprogress`),
 * o que Server Actions não expõem.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  const file = formData.get("file");
  const advertiserId = String(formData.get("advertiserId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationSecondsRaw = Number(formData.get("durationSeconds"));
  const durationSeconds =
    Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
      ? Math.round(durationSecondsRaw)
      : 0;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!advertiserId || !title) {
    return NextResponse.json(
      { error: "Anunciante e título são obrigatórios." },
      { status: 400 },
    );
  }
  if (!ALLOWED_AD_MIME_TYPES.includes(file.type as (typeof ALLOWED_AD_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: `Formato não suportado (${file.type || "desconhecido"}). Envie um MP4.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_AD_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo excede o limite de ${MAX_AD_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);
  if (!advertiser) {
    return NextResponse.json({ error: "Anunciante não encontrado." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Hash calculado sobre os bytes reais que vão pro MinIO — o worker recalcula
  // o mesmo hash ao baixar o arquivo, como conferência extra de integridade.
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `ads/${randomUUID()}.mp4`;

  await uploadAdVideo(storageKey, buffer, file.type);

  const [ad] = await db
    .insert(ads)
    .values({
      advertiserId,
      categoryId: categoryId || null,
      title,
      description: description || null,
      storageKey,
      sizeBytes: file.size,
      durationSeconds,
      sha256,
      status: "rascunho",
    })
    .returning({ id: ads.id });

  await db.insert(jobs).values({
    type: "validate_video",
    payload: { adId: ad.id, storageKey },
  });

  revalidatePath("/anuncios");

  return NextResponse.json({ id: ad.id }, { status: 201 });
}
