import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Mini World · A little planet. A big adventure.',
  description:
    'A playful 3D world for little explorers. Wander through forests, hop across the desert, and splash in the ocean.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
