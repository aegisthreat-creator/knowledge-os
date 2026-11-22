import {
  Bot,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Library,
  Search,
  Settings,
  Share2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Knowledge',
    items: [
      { href: '/notes', label: 'Notes', icon: FileText },
      { href: '/library', label: 'Library', icon: Library },
      { href: '/documents', label: 'Documents', icon: FolderOpen },
    ],
  },
  {
    label: 'AI tools',
    items: [
      { href: '/assistant', label: 'Assistant', icon: Bot },
      { href: '/flashcards', label: 'Flashcards', icon: Layers },
      { href: '/graph', label: 'Graph', icon: Share2 },
    ],
  },
  {
    label: 'General',
    items: [
      { href: '/search', label: 'Search', icon: Search },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];
