'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/people', label: 'Members' },
  { href: '/community/families', label: 'Families' },
  { href: '/community/visitors', label: 'Visitors' },
  { href: '/community/attendance', label: 'Attendance' },
  { href: '/community/departments', label: 'Departments' },
  { href: '/community/volunteers', label: 'Volunteers' },
  { href: '/community/relationships', label: 'Relationships' },
  { href: '/memory', label: 'Memory' },
  { href: '/sermons', label: 'Sermons' },
  { href: '/accounting', label: 'Accounting' },
] as const;

export function SectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace sections" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? 'bg-zion-500/15 text-zion-100'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
