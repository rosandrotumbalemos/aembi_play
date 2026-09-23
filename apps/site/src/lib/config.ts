/**
 * URL do painel administrativo (apps/web) — pra onde o botão "Entrar" leva.
 * Configurável via .env na raiz do monorepo; em produção deve apontar pro
 * domínio real do painel.
 */
export const PAINEL_URL = process.env.NEXT_PUBLIC_PAINEL_URL ?? "http://localhost:3000";
