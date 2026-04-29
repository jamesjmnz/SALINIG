import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Salinig Console',
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
