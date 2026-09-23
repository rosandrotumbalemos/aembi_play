"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  ListVideo,
  CalendarRange,
  Megaphone,
  Handshake,
  BadgePercent,
  ListChecks,
  Clapperboard,
  FolderTree,
  History,
  HardDrive,
  UserCog,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: readonly NavItem[] };

/**
 * Navegação — antes uma sidebar agrupada (PROJECT_BRIEF.md seção 9.1), agora
 * uma navbar superior fixa no estilo Netflix (identidade visual da Fase 0,
 * seção 9.3): um link direto para o Dashboard e o resto agrupado em menus
 * suspensos, sem sidebar colapsável.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/telas", label: "Telas", icon: Monitor },
      { href: "/playlists", label: "Playlists", icon: ListVideo },
      { href: "/agenda", label: "Agenda", icon: CalendarRange },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/anunciantes", label: "Anunciantes", icon: Handshake },
      { href: "/campanhas", label: "Campanhas", icon: Megaphone },
      { href: "/exibicoes", label: "Exibições", icon: ListChecks },
      { href: "/planos", label: "Planos", icon: BadgePercent },
    ],
  },
  {
    label: "Biblioteca",
    items: [
      { href: "/anuncios", label: "Anúncios", icon: Clapperboard },
      { href: "/categorias", label: "Categorias", icon: FolderTree },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/historico", label: "Histórico", icon: History },
      { href: "/armazenamento", label: "Armazenamento/Drive", icon: HardDrive },
      { href: "/usuarios", label: "Usuários", icon: UserCog },
    ],
  },
] as const;

const DASHBOARD_ITEM: NavItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => pathname === item.href);
}

function NavGroupMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = isGroupActive(group, pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/nav-trigger inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground aria-expanded:text-foreground",
          active && "text-foreground",
        )}
      >
        {group.label}
        <ChevronDown className="size-3.5 text-muted-foreground/70 transition-transform group-aria-expanded/nav-trigger:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={10} className="min-w-48">
        {group.items.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
            <item.icon className="size-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  const [lastPathname, setLastPathname] = React.useState(pathname);

  // Fecha o menu ao navegar — ajuste de estado durante a renderização
  // (padrão recomendado pelo React), evita disparar setState num efeito.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        className="inline-flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-14 z-40 border-b border-border bg-popover/95 p-3 backdrop-blur-xl">
          <nav className="flex flex-col gap-1">
            <Link
              href={DASHBOARD_ITEM.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === DASHBOARD_ITEM.href && "bg-accent text-accent-foreground",
              )}
            >
              <DASHBOARD_ITEM.icon className="size-4" />
              {DASHBOARD_ITEM.label}
            </Link>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="pt-2">
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground/70">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                      pathname === item.href && "bg-accent text-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="relative flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Aembi Play"
            width={236}
            height={107}
            priority
            className="h-6 w-auto [filter:brightness(0)_invert(1)]"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href={DASHBOARD_ITEM.href}
            className={cn(
              "inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              pathname === DASHBOARD_ITEM.href && "text-foreground",
            )}
          >
            {DASHBOARD_ITEM.label}
          </Link>
          {NAV_GROUPS.map((group) => (
            <NavGroupMenu key={group.label} group={group} pathname={pathname} />
          ))}
        </nav>

        <div className="ml-auto flex items-center">
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </header>
  );
}
