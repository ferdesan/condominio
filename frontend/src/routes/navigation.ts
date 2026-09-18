import {
  Bell,
  Building2,
  CalendarCheck,
  Car,
  ClipboardList,
  Contact,
  DoorOpen,
  FileText,
  Gauge,
  HardHat,
  Home,
  KeyRound,
  Mail,
  Megaphone,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Users,
  Vote,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permissao exigida; sem ela o item some do menu e a rota nega o acesso. */
  permission?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * Fonte unica da navegacao: a sidebar renderiza a partir daqui e o router cria
 * uma rota por item, cada uma guardada pela mesma permissao.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Visão geral',
    items: [{ to: '/', label: 'Dashboard', icon: Gauge, permission: 'dashboard:read' }],
  },
  {
    title: 'Estrutura',
    items: [
      { to: '/condominios', label: 'Condomínios', icon: Building2, permission: 'condominium:read' },
      { to: '/blocos', label: 'Blocos e torres', icon: Home, permission: 'block:read' },
      { to: '/unidades', label: 'Unidades', icon: DoorOpen, permission: 'unit:read' },
    ],
  },
  {
    title: 'Pessoas',
    items: [
      { to: '/moradores', label: 'Moradores', icon: Users, permission: 'resident:read' },
      { to: '/dependentes', label: 'Dependentes', icon: Contact, permission: 'dependent:read' },
      { to: '/funcionarios', label: 'Funcionários', icon: UserCog, permission: 'employee:read' },
      {
        to: '/prestadores',
        label: 'Prestadores',
        icon: HardHat,
        permission: 'service-provider:read',
      },
    ],
  },
  {
    title: 'Portaria',
    items: [
      { to: '/visitantes', label: 'Visitantes', icon: ClipboardList, permission: 'visitor:read' },
      { to: '/veiculos', label: 'Veículos', icon: Car, permission: 'vehicle:read' },
      {
        to: '/correspondencias',
        label: 'Correspondências',
        icon: Mail,
        permission: 'correspondence:read',
      },
    ],
  },
  {
    title: 'Convivência',
    items: [
      {
        to: '/areas-comuns',
        label: 'Áreas comuns',
        icon: CalendarCheck,
        permission: 'common-area:read',
      },
      { to: '/reservas', label: 'Reservas', icon: CalendarCheck, permission: 'reservation:read' },
      { to: '/assembleias', label: 'Assembleias', icon: Vote, permission: 'assembly:read' },
      {
        to: '/comunicados',
        label: 'Comunicados',
        icon: Megaphone,
        permission: 'announcement:read',
      },
    ],
  },
  {
    title: 'Operação',
    items: [
      { to: '/financeiro', label: 'Financeiro', icon: Wallet, permission: 'charge:read' },
      {
        to: '/ocorrencias',
        label: 'Ocorrências',
        icon: TriangleAlert,
        permission: 'incident:read',
      },
      { to: '/manutencoes', label: 'Manutenções', icon: Wrench, permission: 'maintenance:read' },
      { to: '/documentos', label: 'Documentos', icon: FileText, permission: 'document:read' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { to: '/notificacoes', label: 'Notificações', icon: Bell },
      { to: '/usuarios', label: 'Usuários', icon: ShieldCheck, permission: 'user:read' },
      { to: '/papeis', label: 'Papéis', icon: KeyRound, permission: 'role:read' },
      { to: '/auditoria', label: 'Auditoria', icon: ScrollText, permission: 'audit-log:read' },
      {
        // Por tenant, como Usuarios e Auditoria: nao herda o seletor do shell.
        // `tenant:read` abre; `tenant:update` libera a edicao la dentro — o
        // SINDICO tem so a primeira, e precisa conhecer a politica de encargos
        // aplicada as cobrancas sem poder muda-la.
        to: '/configuracoes',
        label: 'Configurações',
        icon: Settings,
        permission: 'tenant:read',
      },
    ],
  },
  {
    // Secao propria de proposito (ADR-005): LGPD trata de direitos de dados, e
    // nao de uma colecao de negocio — mistura-la com os modulos faria o item
    // sumir quando o papel nao le aquele recurso.
    title: 'Privacidade',
    items: [{ to: '/lgpd', label: 'LGPD', icon: Shield, permission: 'lgpd:read' }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
