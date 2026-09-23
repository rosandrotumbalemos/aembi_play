import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-border px-6 py-10 text-sm text-muted-foreground sm:px-12">
      <div className="flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="Aembi Play"
          width={236}
          height={107}
          className="h-4 w-auto opacity-60 [filter:brightness(0)_invert(1)]"
        />
        <span>© 2026 Aembi Play. Todos os direitos reservados.</span>
      </div>
      <div className="flex flex-wrap gap-6">
        <Link href="/quem-somos">Quem somos</Link>
        <Link href="/como-funciona">Como funciona</Link>
        <Link href="/contato">Contato</Link>
        <Link href="/login">Entrar</Link>
      </div>
    </footer>
  );
}
