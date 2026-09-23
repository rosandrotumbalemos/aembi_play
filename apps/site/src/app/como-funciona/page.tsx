import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow } from "@/components/eyebrow";

export const metadata: Metadata = {
  title: "Como funciona — Aembi Play",
};

const STEPS = [
  {
    n: "01",
    title: "Cadastre o anunciante e o anúncio",
    description:
      "Upload de vídeo até 30 MB em MP4 (H.264/AAC), com título, descrição e categoria. O sistema valida o formato automaticamente antes de liberar a publicação.",
  },
  {
    n: "02",
    title: "Monte a campanha em um assistente de etapas",
    description:
      "Anunciante → anúncio → telas contratadas → horário → data de início → data de término → plano. A cada tela escolhida, o painel mostra a capacidade livre no período — sem risco de lotar o ciclo.",
  },
  {
    n: "03",
    title: "Pareie a tela com um código",
    description:
      "Ao ligar o player pela primeira vez, ele mostra um código na tela. Basta digitar esse código no painel para vincular o dispositivo à rede, com sua orientação (paisagem ou retrato).",
  },
  {
    n: "04",
    title: "O player entra no ar sozinho",
    description:
      "Ele baixa o manifesto da programação, confere a integridade de cada vídeo e toca o ciclo em loop — e continua tocando com o último manifesto válido mesmo se a internet cair.",
  },
  {
    n: "05",
    title: "Acompanhe tudo em tempo real",
    description:
      "Status online, sem sinal ou offline por tela, comandos remotos (recarregar, pausar, tela de emergência) e um relatório de exibições que serve de comprovação de entrega para o anunciante.",
  },
];

const SPECS = [
  { value: "3 min / 12", label: "ciclo dividido em espaços de 15s por tela" },
  { value: "SHA-256", label: "cada vídeo é verificado por hash antes de tocar" },
  { value: "30–60s", label: "intervalo do heartbeat que atualiza o status da tela" },
  { value: "0° / 90° / 180° / 270°", label: "orientações suportadas, com rotação aplicada pelo player" },
];

export default function ComoFuncionaPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteNavbar active="/como-funciona" />

      <main className="flex-1">
        <section className="mx-auto flex max-w-[820px] flex-col items-center gap-5 px-6 pt-24 pb-14 text-center sm:px-12">
          <Eyebrow>Como funciona</Eyebrow>
          <h1 className="text-[44px] leading-[1.15] font-semibold tracking-tight">
            Do cadastro à tela, em 5 passos
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Nenhuma etapa manual entre montar a campanha e ela aparecer na tela certa, no horário
            certo.
          </p>
        </section>

        <section className="mx-auto mb-24 flex max-w-[880px] flex-col gap-4 px-6 sm:px-12">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex items-start gap-5 rounded-2xl border border-border bg-panel p-7"
            >
              <div className="flex h-10 min-w-10 items-center justify-center rounded-[10px] bg-primary/14 font-mono text-[15px] font-semibold text-primary">
                {step.n}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-lg font-semibold">{step.title}</div>
                <div className="text-[15px] leading-relaxed text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mx-auto mb-24 max-w-[1200px] px-6 sm:px-12">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="mb-3 text-[30px] font-semibold tracking-tight">Por baixo do capô</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Alguns detalhes técnicos de como a rede se mantém confiável.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SPECS.map((spec) => (
              <div key={spec.value} className="rounded-[14px] border border-border bg-panel-inset p-5">
                <div className="font-mono text-xl font-semibold text-primary">{spec.value}</div>
                <div className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                  {spec.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mb-24 flex max-w-[1200px] flex-col items-center gap-5 px-6 text-center sm:px-12">
          <h2 className="text-[30px] font-semibold">Viu como funciona. Bora colocar no ar?</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/contato"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
            >
              Falar com a gente
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-panel px-6 text-[15px] font-semibold"
            >
              Entrar no painel
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
