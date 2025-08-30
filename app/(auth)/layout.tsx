import type { Metadata } from 'next';
import AuthBackground from '@/components/auth-background';

export const metadata: Metadata = {
  title: 'Authentication',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh">
      <AuthBackground />
      {children}
    </div>
  );
}
