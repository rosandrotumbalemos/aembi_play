import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow } from "@/components/eyebrow";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contato — Aembi Play",
};

const CONTACT_ROWS = [
  { icon: Mail, label: "E-mail", value: "[e-mail de contato]" },
  { icon: Phone, label: "Telefone / WhatsApp", value: "[telefone de contato]" },
  { icon: MapPin, label: "Endereço", value: "[endereço / região de atendimento]" },
];

export default function ContatoPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteNavbar active="/contato" />

      <main className="flex-1">
        <section className="mx-auto flex max-w-[820px] flex-col items-center gap-5 px-6 pt-24 pb-12 text-center sm:px-12">
          <Eyebrow>Contato</Eyebrow>
          <h1 className="text-[44px] leading-[1.15] font-semibold tracking-tight">
            Fale com a gente
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Conte onde suas telas estão e o que você precisa exibir — a gente responde com os
            próximos passos.
          </p>
        </section>

        <section className="mx-auto mb-24 grid max-w-[1100px] grid-cols-1 gap-6 px-6 sm:px-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-3.5">
            {CONTACT_ROWS.map((row) => (
              <div
                key={row.label}
                className="flex items-start gap-3.5 rounded-[14px] border border-border bg-panel p-5"
              >
                <div className="flex size-9 min-w-9 items-center justify-center rounded-[9px] bg-primary/14 text-primary">
                  <row.icon className="size-[18px]" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[13px] text-muted-foreground">{row.label}</div>
                  <div className="mt-0.5 text-[15px] font-medium">{row.value}</div>
                </div>
              </div>
            ))}
          </div>

          <ContactForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
