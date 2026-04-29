import Link from 'next/link';

export default function Nav() {
  return (
    <nav>
      <Link className="nav-logo" href="/">Salinig</Link>
      <ul className="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#how">How It Works</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>
      <div className="nav-right">
        <Link href="/console" className="nav-cta">Open Console →</Link>
      </div>
    </nav>
  );
}
