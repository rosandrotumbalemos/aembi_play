import { NextResponse } from "next/server";

/**
 * As rotas de `/api/player/*` são chamadas pelo player (apps/player), que
 * roda como PWA em outra origem/porta — em produção, provavelmente outro
 * domínio (mini PC/TV box), não o mesmo host do painel. Não há cookie de
 * sessão nem CSRF aqui: a autenticação é o `deviceToken` (bearer) gerado no
 * pareamento, então liberar qualquer origem é seguro e necessário pro
 * `fetch` do player não ser bloqueado pelo navegador.
 */
export function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, If-None-Match, Content-Type");
  return response;
}

/** Handler de OPTIONS (preflight) compartilhado pelas rotas do player. */
export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
