import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TRACE · 捏住一个瞬间',
  description: '把那些不想打断、又不想忘记的好时刻，轻轻留下。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
