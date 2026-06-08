import Link from "next/link";

/**
 * Shared chrome for the blog index and individual post pages. Renders a
 * lightweight marketing-styled nav and footer that matches the rest of
 * the public site without duplicating the giant CSS from
 * marketing-home.html.
 *
 * Kept minimal: ink/cream palette, Fraunces + Newsreader + Onest, just
 * enough layout to feel like the rest of the site without taking on the
 * 7,000 lines of marketing CSS as a hard dependency.
 */
interface BlogShellProps {
  children: React.ReactNode;
  /** Hint for the index link's active state. */
  active?: "index" | "post";
}

export function BlogShell({ children, active }: BlogShellProps) {
  return (
    <>
      <style>{BLOG_CSS}</style>
      <nav className="blog-nav">
        <div className="blog-nav-inner">
          <Link href="/" className="blog-nav-logo">
            <span className="blog-nav-logo-mark">B</span>
            BAAM Review
          </Link>
          <div className="blog-nav-links">
            <Link href="/about">About</Link>
            <Link
              href="/blog"
              className={active === "index" ? "active" : undefined}
            >
              Blog
            </Link>
            <Link href="/case-studies">Case Studies</Link>
            <Link href="/audit/">Free Audit</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <Link href="/audit/" className="blog-nav-cta">
            Get free audit →
          </Link>
        </div>
      </nav>

      <main className="blog-main">{children}</main>

      <footer className="blog-footer">
        <div className="blog-footer-inner">
          <div className="blog-footer-brand">BAAM Review</div>
          <p className="blog-footer-tagline">
            A Review-to-Revenue Engine for local businesses. From BAAM Studio.
          </p>
          <div className="blog-footer-links">
            <Link href="/about">About</Link>
            <Link href="/case-studies">Case Studies</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
          </div>
          <p className="blog-footer-copy">© BAAM Studio. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

const BLOG_CSS = `
:root {
  --bl-cream: #FAF7F2;
  --bl-cream-deep: #F4EFE2;
  --bl-paper: #FBF8F1;
  --bl-ink: #1c1c1c;
  --bl-ink-soft: #3D3833;
  --bl-text: #2a2a2a;
  --bl-text-soft: #555;
  --bl-text-muted: #888;
  --bl-border: #E6DECF;
  --bl-rule: #DDD3BF;
  --bl-forest: #2D4A3A;
  --bl-forest-dark: #1F3528;
  --bl-gold: #C9A961;
  --bl-gold-dark: #6F5320;
  --bl-gold-soft: #E8D9B5;
  --bl-rust-deep: #842F1B;
}
html, body { background: var(--bl-cream); margin: 0; padding: 0; }
body {
  font-family: 'Onest', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--bl-text);
  line-height: 1.65;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

/* ============ NAV ============ */
.blog-nav {
  position: sticky;
  top: 0; z-index: 50;
  background: rgba(250, 247, 242, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--bl-border);
}
.blog-nav-inner {
  max-width: 1200px; margin: 0 auto;
  padding: 18px 32px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.blog-nav-logo {
  display: inline-flex; align-items: center; gap: 12px;
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-size: 21px; font-weight: 500;
  color: var(--bl-ink); text-decoration: none;
}
.blog-nav-logo-mark {
  width: 32px; height: 32px;
  background: var(--bl-forest); color: var(--bl-cream);
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 600;
}
.blog-nav-links { display: flex; gap: 22px; align-items: center; }
.blog-nav-links a {
  font-size: 14px; color: var(--bl-text-soft);
  text-decoration: none; transition: color 0.15s;
}
.blog-nav-links a:hover, .blog-nav-links a.active { color: var(--bl-ink); }
.blog-nav-cta {
  font-size: 13.5px; font-weight: 500;
  background: var(--bl-forest); color: var(--bl-cream);
  padding: 9px 16px; border-radius: 999px;
  text-decoration: none;
}
.blog-nav-cta:hover { background: var(--bl-forest-dark); }
@media (max-width: 760px) { .blog-nav-links { display: none; } }

/* ============ MAIN ============ */
.blog-main { max-width: 820px; margin: 0 auto; padding: 60px 32px 80px; }

/* ============ HERO ============ */
.blog-hero { margin-bottom: 56px; padding-bottom: 36px; border-bottom: 1px solid var(--bl-border); }
.blog-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--bl-gold-dark);
  font-weight: 600;
  margin: 0 0 18px;
}
.blog-h1 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 400;
  font-size: clamp(34px, 4.5vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--bl-ink);
  margin: 0 0 18px;
}
.blog-h1 em { font-style: italic; color: var(--bl-gold-dark); }
.blog-deck {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 19px;
  line-height: 1.55;
  color: var(--bl-text-soft);
  max-width: 620px;
  margin: 0;
}
.blog-empty {
  font-style: italic;
  color: var(--bl-text-muted);
  background: var(--bl-paper);
  border: 1px dashed var(--bl-rule);
  border-radius: 12px;
  padding: 24px;
  font-size: 14.5px;
}
.blog-empty code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 2px 6px;
  background: var(--bl-cream-deep);
  border-radius: 4px;
}

/* ============ LIST ============ */
.blog-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 18px;
}
.blog-card {
  background: var(--bl-paper);
  border: 1px solid var(--bl-border);
  border-radius: 14px;
  padding: 24px 26px 22px;
  transition: border-color 0.15s, transform 0.08s;
}
.blog-card:hover {
  border-color: var(--bl-forest);
  transform: translateY(-1px);
}
.blog-card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}
.blog-card-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bl-text-muted);
  font-weight: 600;
  margin: 0 0 10px;
  display: flex; align-items: center; gap: 8px;
}
.blog-card-sep { color: var(--bl-rule); }
.blog-card-tag {
  background: var(--bl-gold-soft);
  color: var(--bl-gold-dark);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.blog-card-title {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 500;
  font-size: 24px;
  line-height: 1.18;
  letter-spacing: -0.012em;
  color: var(--bl-ink);
  margin: 0 0 8px;
}
.blog-card-excerpt {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--bl-text-soft);
  margin: 0 0 14px;
}
.blog-card-cta {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--bl-forest);
}

/* ============ POST ============ */
.blog-post-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bl-text-muted);
  font-weight: 600;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  margin-bottom: 16px;
}
.blog-post-meta .sep { color: var(--bl-rule); }
.blog-post-title {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 400;
  font-size: clamp(34px, 4.5vw, 50px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--bl-ink);
  margin: 0 0 20px;
}
.blog-post-deck {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 20px;
  line-height: 1.55;
  color: var(--bl-text-soft);
  border-bottom: 1px solid var(--bl-border);
  padding-bottom: 28px;
  margin: 0 0 36px;
}
.blog-post-body {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 18px;
  line-height: 1.75;
  color: var(--bl-text);
}
.blog-post-body h2 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 500;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.012em;
  color: var(--bl-ink);
  margin: 48px 0 16px;
}
.blog-post-body h3 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 500;
  font-size: 22px;
  line-height: 1.25;
  color: var(--bl-ink);
  margin: 36px 0 12px;
}
.blog-post-body p { margin: 0 0 22px; }
.blog-post-body a {
  color: var(--bl-forest);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.blog-post-body a:hover { color: var(--bl-forest-dark); }
.blog-post-body em { font-style: italic; }
.blog-post-body strong {
  font-family: 'Onest', sans-serif;
  font-weight: 600;
  font-size: 17px;
  color: var(--bl-ink);
}
.blog-post-body ul, .blog-post-body ol { margin: 0 0 22px; padding-left: 28px; }
.blog-post-body li { margin-bottom: 8px; }
.blog-post-body blockquote {
  border-left: 3px solid var(--bl-gold);
  padding-left: 20px;
  margin: 28px 0;
  font-style: italic;
  color: var(--bl-ink-soft);
}
.blog-post-body code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  background: var(--bl-cream-deep);
  padding: 2px 6px;
  border-radius: 4px;
}
.blog-post-body pre {
  background: var(--bl-ink);
  color: var(--bl-cream);
  padding: 18px 22px;
  border-radius: 10px;
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.55;
}
.blog-post-body pre code { background: transparent; padding: 0; color: inherit; }
.blog-post-body hr {
  border: 0; border-top: 1px solid var(--bl-border);
  margin: 40px 0;
}
.blog-post-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 28px 0;
  font-family: 'Onest', sans-serif;
  font-size: 14.5px;
}
.blog-post-body th, .blog-post-body td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bl-rule);
  text-align: left;
}
.blog-post-body th {
  background: var(--bl-cream-deep);
  font-weight: 600;
  color: var(--bl-ink);
}

/* ============ POST FOOTER (FAQ + CTA) ============ */
.blog-faq {
  margin: 56px 0 0;
  padding: 32px 32px 28px;
  background: var(--bl-paper);
  border: 1px solid var(--bl-border);
  border-radius: 14px;
}
.blog-faq h2 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 500;
  font-size: 22px;
  margin: 0 0 18px;
  color: var(--bl-ink);
}
.blog-faq-item { margin-bottom: 18px; }
.blog-faq-item:last-child { margin-bottom: 0; }
.blog-faq-q {
  font-family: 'Onest', sans-serif;
  font-weight: 600;
  font-size: 15.5px;
  color: var(--bl-ink);
  margin: 0 0 6px;
}
.blog-faq-a {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--bl-text-soft);
  margin: 0;
}

.blog-cta {
  margin-top: 36px;
  background: var(--bl-ink);
  color: var(--bl-cream);
  padding: 28px 32px;
  border-radius: 14px;
  display: flex; flex-wrap: wrap;
  align-items: center; justify-content: space-between;
  gap: 16px;
}
.blog-cta-text {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-size: 20px;
  line-height: 1.3;
  max-width: 440px;
}
.blog-cta-text em { font-style: italic; color: var(--bl-gold); }
.blog-cta-btn {
  background: var(--bl-gold);
  color: var(--bl-ink);
  padding: 10px 20px;
  border-radius: 999px;
  font-family: 'Onest', sans-serif;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}
.blog-cta-btn:hover { background: var(--bl-gold-soft); }

/* ============ FOOTER ============ */
.blog-footer {
  background: var(--bl-cream-deep);
  border-top: 1px solid var(--bl-border);
  padding: 40px 0 36px;
  margin-top: 60px;
}
.blog-footer-inner {
  max-width: 820px; margin: 0 auto;
  padding: 0 32px;
}
.blog-footer-brand {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-size: 18px; font-weight: 500;
  color: var(--bl-ink); margin-bottom: 8px;
}
.blog-footer-tagline {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 14.5px;
  color: var(--bl-text-soft);
  margin: 0 0 18px;
}
.blog-footer-links {
  display: flex; gap: 18px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.blog-footer-links a {
  color: var(--bl-text-soft);
  text-decoration: none;
  font-size: 13.5px;
}
.blog-footer-links a:hover { color: var(--bl-ink); }
.blog-footer-copy {
  font-size: 12px;
  color: var(--bl-text-muted);
  margin: 0;
}
`;
