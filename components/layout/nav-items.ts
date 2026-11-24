import {
  LayoutDashboard,
  ListChecks,
  Plug,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  /** Aparece en la barra inferior del móvil */
  mobileTab: boolean;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", shortLabel: "Panel", Icon: LayoutDashboard, mobileTab: true },
  { href: "/aparatos", label: "Mis aparatos", shortLabel: "Aparatos", Icon: Plug, mobileTab: true },
  { href: "/habitos", label: "Hábitos", shortLabel: "Hábitos", Icon: ListChecks, mobileTab: true },
  { href: "/retos", label: "Retos semanales", shortLabel: "Retos", Icon: Trophy, mobileTab: true },
  { href: "/comunidad", label: "Comunidad", shortLabel: "Comunidad", Icon: Users, mobileTab: true },
  { href: "/perfil", label: "Mi perfil", shortLabel: "Perfil", Icon: UserRound, mobileTab: false },
  { href: "/admin", label: "Administración", shortLabel: "Admin", Icon: ShieldCheck, mobileTab: false, adminOnly: true },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
