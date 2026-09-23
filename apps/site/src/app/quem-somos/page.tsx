import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Monitor, ShieldCheck } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow } from "@/components/eyebrow";
import { FeatureCard } from "@/components/feature-card";

export const metadata: Metadata = {
  title: "Quem somos — Aembi Play",
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Confiabilidade",
    description:
      "Um player que continua tocando o último manifesto válido mesmo se a internet cair — a tela nunca fica preta por causa da rede.",
  },
  {
    icon: CheckCircle2,
    title: "Transparência",
    description:
      "Toda exibição é registrada pelo player e todo histórico de alteração fica auditável — nada acontece sem deixar rastro.",
  },
  {
    icon: Monitor,
    title: "Simplicidade",
    description:
      "Cadastro guiado por etapas, uma ação principal por tela e status sempre com cor e texto — pensado pra quem opera no dia a dia.",
  },
];

export default function QuemSomosPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteNavbar active="/quem-somos" />

      <main className="flex-1">
        <section className="mx-auto flex max-w-[820px] flex-col items-center gap-5 px-6 pt-24 pb-14 text-center sm:px-12">
          <Eyebrow>Quem somos</Eyebrow>
          <h1 className="text-[44px] leading-[1.15] font-semibold tracking-tight">
            Uma plataforma pensada pra quem cuida de uma rede de telas de verdade
          </h1>
        </section>

        <section className="mx-auto mb-16 flex max-w-[760px] flex-col gap-5 px-6 sm:px-12">
          <p className="text-[17px] leading-relaxed text-[#c7c8d1]">
            A Aembi Play nasceu de um problema simples de descrever e cansativo de resolver na
            prática: trocar vídeo manualmente, tela por tela, sempre que uma campanha muda. Em vez
            disso, um painel único cuida do cadastro dos anunciantes, monta a programação de cada
            tela e acompanha se ela está mesmo no ar.
          </p>
          <p className="text-[17px] leading-relaxed text-[#c7c8d1]">
            A plataforma é dividida em três peças que conversam entre si: o{" "}
            <strong className="font-semibold text-foreground">painel administrativo</strong>, onde
            anunciantes, anúncios, telas e campanhas são cadastrados e programados; o{" "}
            <strong className="font-semibold text-foreground">player</strong>, que roda em tela
            cheia no dispositivo ligado à TV e reproduz a playlist mesmo sem internet; e o{" "}
            <strong className="font-semibold text-foreground">worker</strong>, que processa
            vídeos, faz backup e cuida da expiração automática das campanhas em segundo plano.
          </p>
          <p className="text-[17px] leading-relaxed text-[#c7c8d1]">
            [Espaço reservado para a história da empresa/equipe por trás da Aembi Play — quem
            somos, desde quando operamos e onde atuamos.]
          </p>
        </section>

        <section className="mx-auto mb-24 max-w-[1200px] px-6 sm:px-12">
          <div className="mx-auto mb-10 max-w-lg text-center">
            <h2 className="text-[30px] font-semibold tracking-tight">
              O que guia como construímos
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {VALUES.map((v) => (
              <FeatureCard key={v.title} {...v} />
            ))}
          </div>
        </section>

        <section className="mx-auto mb-24 max-w-[1200px] px-6 sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[20px] border border-border bg-panel p-10">
            <div className="flex max-w-lg flex-col gap-2.5">
              <div className="text-[22px] font-semibold">Quer conversar sobre sua rede de telas?</div>
              <div className="text-[15px] leading-relaxed text-muted-foreground">
                Conta pra gente onde suas telas estão e o que você precisa exibir.
              </div>
            </div>
            <Link
              href="/contato"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground whitespace-nowrap"
            >
              Falar com a gente
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
