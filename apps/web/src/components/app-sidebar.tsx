"use client";

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
  Clapperboard,
  FolderTree,
  History,
  HardDrive,
  UserCog,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/** Navegação lateral agrupada — PROJECT_BRIEF.md seção 9.1. */
const NAV_GROUPS = [
  {
    label: "Visão geral",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="block group-data-[collapsible=icon]:hidden">
          <Image
            src="/logo.png"
            alt="Aembi Play"
            width={236}
            height={107}
            priority
            className="h-10 w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 text-xs text-muted-foreground">
        Fase 1 — Núcleo
      </SidebarFooter>
    </Sidebar>
  );
}
