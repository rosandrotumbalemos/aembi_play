import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Download,
  Monitor,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow } from "@/components/eyebrow";
import { FeatureCard } from "@/components/feature-card";
import { StatusBadge } from "@/components/status-badge";

const SCREENS_PREVIEW = [
  { name: "Recepção — Loja Centro", since: "pareada há 3 meses", status: "online" as const },
  { name: "Fachada — Loja Zona Sul", since: "pareada há 6 meses", status: "sem_sinal" as const },
  { name: "Corredor 2 — Loja Norte", since: "pareada há 1 mês", status: "online" as const },
];

const FEATURES = [
  {
    icon: Monitor,
    title: "Painel administrativo completo",
    description:
      "Cadastre anunciantes, anúncios, telas, planos e campanhas em um só lugar, com histórico de tudo o que foi alterado.",
  },
  {
    icon: Download,
    title: "Player que funciona offline",
    description:
      "A playlist fica em cache no dispositivo: se a internet cair, a tela continua tocando com o último manifesto válido.",
  },
  {
    icon: Activity,
    title: "Telas online em tempo real",
    description:
      "Cada player envia um heartbeat a cada 30–60s. O painel mostra na hora quem está online, sem sinal ou offline.",
  },
  {
    icon: CheckCircle2,
    title: "Comprovação de exibição",
    description:
      "Cada vez que um anúncio toca, o player registra a exibição — a base do relatório entregue ao anunciante.",
  },
  {
    icon: UploadCloud,
    title: "Backup automático",
    description:
      "Todo vídeo publicado é enviado automaticamente pro Google Drive — nada de anúncio importante só no disco local.",
  },
  {
    icon: ShieldCheck,
    title: "Controle de capacidade",
    description:
      "Ao criar uma campanha, o sistema calcula os espaços livres do ciclo em cada tela e bloqueia quem já está lotado.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteNavbar active="/" />

      <main className="flex-1">
        <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-7 px-6 pt-24 pb-16 text-center sm:px-12">
          <Eyebrow>Sinalização digital em rede</Eyebrow>
          <h1 className="max-w-3xl text-[56px] leading-[1.08] font-semibold tracking-tight">
            Uma rede de telas, programada e monitorada em um único painel
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            A Aembi Play cadastra anunciantes, monta a programação de cada tela e mantém tudo no
            ar — mesmo se a internet cair. Sem trocar vídeo manualmente, tela por tela.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
            >
              Entrar no painel
            </Link>
            <Link
              href="/como-funciona"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-panel px-6 text-[15px] font-semibold"
            >
              Ver como funciona
            </Link>
          </div>
        </section>

        <section className="mx-auto mb-24 max-w-[1000px] px-6 sm:px-12">
          <div className="flex flex-col gap-4.5 rounded-[20px] border border-border bg-panel p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-medium tracking-wide text-muted-foreground">
                STATUS DA REDE — AGORA
              </span>
              <span className="text-xs text-muted-foreground">atualizado a cada 30–60s</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {SCREENS_PREVIEW.map((screen) => (
                <div
                  key={screen.name}
                  className="flex flex-col gap-2.5 rounded-xl border border-white/8 bg-panel-inset p-4"
                >
                  <div className="text-sm font-semibold">{screen.name}</div>
                  <div className="text-xs text-muted-foreground">{screen.since}</div>
                  <StatusBadge status={screen.status} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mb-24 max-w-[1200px] px-6 sm:px-12">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="mb-3 text-[34px] font-semibold tracking-tight">
              Tudo que uma rede de mídia precisa
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Do cadastro do anunciante até a comprovação de exibição, em um único sistema.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        <section className="mx-auto mb-24 max-w-[1200px] px-6 sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[20px] border border-border bg-panel p-10">
            <div className="flex max-w-lg flex-col gap-2.5">
              <span className="font-mono text-[13px] font-semibold tracking-wide text-primary">
                COMO FUNCIONA
              </span>
              <div className="text-2xl font-semibold">Do cadastro à tela, em 5 passos</div>
              <div className="text-[15px] leading-relaxed text-muted-foreground">
                Cadastre o anunciante e o anúncio, monte a campanha, pareie a tela e acompanhe tudo
                em tempo real.
              </div>
            </div>
            <Link
              href="/como-funciona"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/14 bg-white/6 px-6 text-[15px] font-semibold whitespace-nowrap"
            >
              Ver o passo a passo
            </Link>
          </div>
        </section>

        <section className="mx-auto mb-24 flex max-w-[1200px] flex-col items-center gap-5 px-6 text-center sm:px-12">
          <h2 className="text-[30px] font-semibold">Pronto para colocar sua rede no ar?</h2>
          <p className="max-w-md text-base text-muted-foreground">
            Fale com a gente pra configurar sua primeira tela, ou entre direto no painel se já tem
            acesso.
          </p>
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
