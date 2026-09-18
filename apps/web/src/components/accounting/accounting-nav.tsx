'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/accounting', label: 'Ledger', exact: true },
  { href: '/accounting/journals', label: 'Journals' },
  { href: '/accounting/giving', label: 'Giving' },
  { href: '/accounting/payroll', label: 'Payroll' },
  { href: '/accounting/budgets', label: 'Budgets' },
  { href: '/accounting/projects', label: 'Projects' },
  { href: '/accounting/procurement', label: 'Procurement' },
  { href: '/accounting/recon', label: 'Bank rec' },
  { href: '/accounting/reports', label: 'Reports' },
] as const;

export function AccountingNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Accounting sections" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const exact = 'exact' in link && link.exact;
        const active = exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
