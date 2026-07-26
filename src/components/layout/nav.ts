import {
  LayoutDashboard,
  Users,
  Package,
  Scissors,
  Tag,
  Receipt,
  Truck,
  Wallet,
  Coins,
  UsersRound,
  UserPlus,
  ClipboardList,
  ListOrdered,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, group: "Général" },

  { href: "/clients", label: "Clients", icon: Users, group: "Catalogue" },
  { href: "/produits", label: "Produits", icon: Package, group: "Catalogue" },
  { href: "/formes", label: "Formes de découpe", icon: Scissors, group: "Catalogue" },
  { href: "/tarification", label: "Tarification", icon: Tag, group: "Catalogue" },

  { href: "/prospects", label: "Prospects", icon: UserPlus, group: "Commercial" },
  { href: "/devis", label: "Devis / Proforma", icon: ClipboardList, group: "Commercial" },
  { href: "/factures", label: "Factures", icon: Receipt, group: "Commercial" },
  { href: "/bons-livraison", label: "Bons de livraison", icon: Truck, group: "Commercial" },
  { href: "/paiements", label: "Paiements & Solde", icon: Wallet, group: "Commercial" },

  { href: "/commande-en-instance", label: "Commande en instance", icon: ListOrdered, group: "Production" },

  { href: "/tresorerie", label: "Trésorerie", icon: Coins, group: "Finances" },
  { href: "/situation-client", label: "Situation client", icon: ScrollText, group: "Finances" },
  { href: "/salaires", label: "Salaires", icon: UsersRound, group: "Finances" },

  { href: "/parametres", label: "Paramètres", icon: Settings, group: "Système" },
];
