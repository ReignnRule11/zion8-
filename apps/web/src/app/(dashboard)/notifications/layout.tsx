import { NotificationsNav } from '@/components/notifications/notifications-nav';

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <NotificationsNav />
      {children}
    </div>
  );
}
