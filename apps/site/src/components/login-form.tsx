"use client";

import { PAINEL_URL } from "@/lib/config";

const inputClass =
  "w-full rounded-lg border border-white/12 bg-panel-inset px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-[#5f616e] focus:border-primary";

export function LoginForm() {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // TODO: sem autenticação própria ainda (Fase 1 não inclui login do
        // admin nem o portal do anunciante — ver PROJECT_BRIEF.md seção 10,
        // Fase 2). Por ora, "Entrar" só leva pro painel de verdade.
        window.location.href = PAINEL_URL;
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-[13px] font-medium text-[#c7c8d1]">
          E-mail
        </label>
        <input id="login-email" name="email" type="email" placeholder="voce@empresa.com" className={inputClass} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="login-senha" className="text-[13px] font-medium text-[#c7c8d1]">
            Senha
          </label>
          <a href="#" className="text-xs text-[#b3a8ff]">
            Esqueci minha senha
          </a>
        </div>
        <input id="login-senha" name="senha" type="password" placeholder="••••••••" className={inputClass} />
      </div>
      <button
        type="submit"
        className="mt-1.5 inline-flex h-11 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-primary-foreground"
      >
        Entrar
      </button>
    </form>
  );
}
