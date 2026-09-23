import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Entrar — Aembi Play",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-7 p-12">
      <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" strokeWidth={1.8} />
        Voltar ao site
      </Link>

      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-[20px] border border-border bg-panel p-10">
        <div className="flex flex-col items-center gap-4.5 text-center">
          <Image
            src="/logo.png"
            alt="Aembi Play"
            width={236}
            height={107}
            className="h-[22px] w-auto [filter:brightness(0)_invert(1)]"
          />
          <div>
            <div className="text-[22px] font-semibold">Entrar no painel</div>
            <div className="mt-1.5 text-sm text-muted-foreground">
              Acesse a Aembi Play com sua conta
            </div>
          </div>
        </div>

        <LoginForm />

        <div className="h-px bg-border" />

        <div className="text-center text-[13px] leading-relaxed text-muted-foreground">
          Ainda não tem acesso?{" "}
          <Link href="/contato" className="font-medium text-[#b3a8ff]">
            Fale com a gente
          </Link>
        </div>
      </div>

      <div className="font-mono text-xs text-[#5f616e]">Aembi Play — painel administrativo</div>
    </div>
  );
}
