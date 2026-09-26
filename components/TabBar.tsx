import Link from 'next/link';
import { HomeIcon, CalendarIcon, RankIcon, SkullIcon, UserIcon } from './Icons';

export type Tab = 'today' | 'archive' | 'ranks' | 'shame' | 'me';

const TABS: { id: Tab; label: string; href: string; Icon: typeof HomeIcon }[] = [
  { id: 'today', label: 'Today', href: '/', Icon: HomeIcon },
  { id: 'archive', label: 'Archive', href: '/archive', Icon: CalendarIcon },
  { id: 'ranks', label: 'Ranks', href: '/ranks', Icon: RankIcon },
  { id: 'shame', label: 'Shame', href: '/shame', Icon: SkullIcon },
  { id: 'me', label: 'Me', href: '/me', Icon: UserIcon },
];

export default function TabBar({ active }: { active: Tab }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ id, label, href, Icon }) => (
        <Link key={id} href={href} aria-current={id === active ? 'page' : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
