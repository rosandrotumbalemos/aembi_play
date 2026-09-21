import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente S3 apontando para o MinIO local (seção 3 do briefing — armazenamento
 * local com cota de 1 GB). O worker Python usa as mesmas credenciais via
 * boto3 para baixar o arquivo na hora de validar (workers/media/storage.py).
 */
const globalForStorage = globalThis as unknown as {
  s3Client?: S3Client;
};

function createS3Client() {
  const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = process.env.MINIO_PORT ?? "9000";
  const useSsl = process.env.MINIO_USE_SSL === "true";

  return new S3Client({
    endpoint: `${useSsl ? "https" : "http"}://${endpoint}:${port}`,
    region: "us-east-1", // MinIO ignora a região, mas o SDK exige um valor
    forcePathStyle: true, // obrigatório para MinIO (URLs no estilo path, não vhost)
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER ?? "aembi_admin",
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "aembi_dev_password",
    },
  });
}

export const s3Client = globalForStorage.s3Client ?? createS3Client();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.s3Client = s3Client;
}

export const AD_BUCKET = process.env.MINIO_BUCKET ?? "aembi-ads";

/** Sobe o vídeo do anúncio para o MinIO sob a chave `ads/<uuid>.mp4`. */
export async function uploadAdVideo(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: AD_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Busca um objeto do MinIO (miniatura ou vídeo) para devolver por um Route
 * Handler autenticado pela sessão do painel — o bucket em si não é público
 * (mesma lógica de "players baixam sempre do servidor" da seção 7.6). `range`
 * repassa o cabeçalho `Range` do pedido original — necessário pro `<video>`
 * do navegador conseguir avançar/voltar sem baixar o arquivo inteiro.
 */
export async function getAdObject(key: string, range?: string) {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: AD_BUCKET, Key: key, Range: range }),
  );
  return result;
}
