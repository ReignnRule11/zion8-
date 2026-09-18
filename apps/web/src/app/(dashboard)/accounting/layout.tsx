import { AccountingNav } from '@/components/accounting/accounting-nav';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AccountingNav />
      {children}
    </div>
  );
}
