"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-white/12 bg-panel-inset px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-[#5f616e] focus:border-primary";

export function ContactForm() {
  // TODO(Fase 2+): trocar por uma API route de verdade (envio de e-mail ou
  // gravação em `leads`/tabela própria) quando o backend do site existir —
  // por enquanto só confirma visualmente no cliente.
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-border bg-panel p-10 text-center">
        <div className="text-lg font-semibold">Mensagem enviada</div>
        <p className="text-sm text-muted-foreground">
          Obrigado pelo contato — a gente responde em breve.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
      className="flex flex-col gap-4.5 rounded-[20px] border border-border bg-panel p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="contato-nome" className="text-[13px] font-medium text-[#c7c8d1]">
            Nome
          </label>
          <input id="contato-nome" name="nome" type="text" required placeholder="Seu nome" className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contato-email" className="text-[13px] font-medium text-[#c7c8d1]">
            E-mail
          </label>
          <input
            id="contato-email"
            name="email"
            type="email"
            required
            placeholder="voce@empresa.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contato-empresa" className="text-[13px] font-medium text-[#c7c8d1]">
          Empresa
        </label>
        <input
          id="contato-empresa"
          name="empresa"
          type="text"
          placeholder="Nome da empresa"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contato-mensagem" className="text-[13px] font-medium text-[#c7c8d1]">
          Mensagem
        </label>
        <textarea
          id="contato-mensagem"
          name="mensagem"
          rows={5}
          required
          placeholder="Quantas telas você tem hoje e onde elas ficam?"
          className={inputClass + " resize-y font-sans"}
        />
      </div>

      <button
        type="submit"
        className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
      >
        Enviar mensagem
      </button>
    </form>
  );
}
