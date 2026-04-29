import type { Metadata } from 'next';
import Nav from '@/components/landing/Nav';
import LandingApp from '@/components/landing/LandingApp';

export const metadata: Metadata = {
  title: 'Salinig — Public Sentiment & Credibility Intelligence',
  description: 'Self-learning multi-agent system for real-time credibility intelligence — powered by Cyclic RAG and live evidence triangulation.',
};

export default function Home() {
  return (
    <>
      <Nav />
      <div id="root">
        <LandingApp />
      </div>
    </>
  );
}
