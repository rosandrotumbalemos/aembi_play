import { NextRequest, NextResponse } from "next/server";
import { collectOutgoingCommands, resolveScreenByToken } from "@/lib/commands";

// Precisa rodar sempre no servidor (stream longo, sem cache) e em runtime
// Node — a rota usa `db` (postgres-js), que não funciona no Edge runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Intervalo de checagem de novos comandos dentro da conexão já aberta —
// não precisa ser tão curto quanto pareceria: é "ações imediatas" em
// comparação ao manifesto/heartbeat (30-45s), não um requisito de latência
// sub-segundo.
const CHECK_INTERVAL_MS = 3_000;
// Comentário SSE (":") periódico só pra manter proxies/load balancers do
// meio do caminho de fechar a conexão por inatividade — não é dado.
const PING_INTERVAL_MS = 20_000;

/**
 * GET /api/player/commands/stream — canal SSE pros controles remotos
 * (seção 5.3). EventSource não permite header Authorization customizado,
 * então o deviceToken viaja na query string só nesta rota (exceção ao
 * padrão Bearer usado no resto de /api/player/*).
 */
export async function GET(request: NextRequest) {
  const deviceToken = request.nextUrl.searchParams.get("token");
  if (!deviceToken) {
    return new NextResponse("Token de dispositivo ausente", { status: 401 });
  }

  const screen = await resolveScreenByToken(deviceToken);
  if (!screen) {
    return new NextResponse("Dispositivo não encontrado", { status: 404 });
  }

  const screenId = screen.id;
  const encoder = new TextEncoder();
  let closed = false;
  let checkTimer: ReturnType<typeof setInterval> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const checkCommands = async () => {
        if (closed) return;
        try {
          const commands = await collectOutgoingCommands(screenId);
          for (const command of commands) {
            if (closed) return;
            controller.enqueue(encoder.encode(`event: command\ndata: ${JSON.stringify(command)}\n\n`));
          }
        } catch (err) {
          console.error("[commands/stream] falha ao checar comandos", err);
        }
      };

      void checkCommands();
      checkTimer = setInterval(() => void checkCommands(), CHECK_INTERVAL_MS);
      pingTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // conexão já fechou do outro lado — cancel() cuida da limpeza.
        }
      }, PING_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      if (checkTimer) clearInterval(checkTimer);
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Mesmo raciocínio de apps/web/src/lib/cors.ts: sem cookie/CSRF, a
      // autenticação é o token na query string, então liberar qualquer
      // origem é seguro e necessário (o player roda em outra porta/origem).
      "Access-Control-Allow-Origin": "*",
    },
  });
}
