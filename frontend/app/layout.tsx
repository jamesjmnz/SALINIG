import type { Metadata } from 'next';
import { Instrument_Serif, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

const dmSans = DM_Sans({
  weight: 'variable',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-dm-sans',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: 'Salinig — Public Sentiment & Credibility Intelligence',
  description: 'Self-learning multi-agent system for real-time credibility intelligence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
