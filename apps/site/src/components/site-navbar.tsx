import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/quem-somos", label: "Quem somos" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/contato", label: "Contato" },
] as const;

export function SiteNavbar({ active }: { active: (typeof NAV_LINKS)[number]["href"] }) {
  return (
    <header className="sticky top-0 z-50 flex h-[72px] items-center border-b border-border bg-navbar px-6 sm:px-12">
      <Link href="/" className="mr-7 flex items-center">
        <Image
          src="/logo.png"
          alt="Aembi Play"
          width={236}
          height={107}
          priority
          className="h-5 w-auto [filter:brightness(0)_invert(1)]"
        />
      </Link>

      <nav className="hidden items-center gap-0.5 md:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              "rounded-lg px-3.5 py-2 text-sm font-medium " +
              (link.href === active ? "bg-white/6 text-foreground" : "text-muted-foreground")
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <Link
        href="/login"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4.5 text-sm font-semibold text-primary-foreground"
      >
        Entrar
      </Link>
    </header>
  );
}
