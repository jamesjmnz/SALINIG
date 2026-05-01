import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="sup-nav">
      <div className="sup-nav-inner">
        <Link className="sup-nav-logo" href="/">
          <span className="sup-nav-logo-icon" aria-hidden="true" />
          Salinig
        </Link>
        <ul className="sup-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#collab">How It Works</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#">Blog</a></li>
        </ul>
        <div className="sup-nav-right">
          <Link href="/console" className="sup-nav-cta">Open Console →</Link>
        </div>
      </div>
    </nav>
  );
}
