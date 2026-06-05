"use client";

import { useEffect, useState } from "react";

interface Slide {
  kind: "maps" | "tool";
  label: string;
  meta: string;
}

const SLIDES: Slide[] = [
  { kind: "tool", label: "Why owners choose BAAM Review", meta: "Built for multilingual local businesses" },
  {
    kind: "maps",
    label: "Client · DR. Huang Acupuncture · Middletown NY",
    meta: "Top 3 for “top acupuncture middletown ny”",
  },
  { kind: "tool", label: "BAAM Review · Weekly request batch", meta: "Self-Serve cadence" },
  {
    kind: "maps",
    label: "Acupuncture · Flushing NY",
    meta: "Top 3 for “acupuncture in flushing ny”",
  },
  { kind: "tool", label: "BAAM Review · AI reply composer", meta: "Bilingual, brand-tone tuned" },
  { kind: "tool", label: "BAAM Review · Monthly client report", meta: "Sent to owner every 1st" },
];

const ROTATE_MS = 5000;

export function HeroRotation() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[idx];

  return (
    <div
      className="hero-rotation"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{CSS}</style>

      <div className="hero-rotation-frame">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={`hero-rotation-slide ${i === idx ? "is-active" : ""}`}
            aria-hidden={i !== idx}
          >
            {s.kind === "maps" ? <MapsSlide index={i} /> : <ToolSlide index={i} />}
          </div>
        ))}
      </div>

      <div className="hero-rotation-caption">
        <span className={`hero-rotation-badge hero-rotation-badge-${slide.kind}`}>
          {slide.kind === "maps" ? "Maps rank · today" : "Tool"}
        </span>
        <span className="hero-rotation-label">{slide.label}</span>
        <span className="hero-rotation-meta">{slide.meta}</span>
      </div>

      <div className="hero-rotation-dots" role="tablist" aria-label="Rotation">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`Slide ${i + 1}`}
            className={`hero-rotation-dot ${i === idx ? "is-active" : ""}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </div>
  );
}

const MAPS_SRC: Record<number, string> = {
  1: "/service-hero/maps-0.png",
  3: "/service-hero/maps-2.png",
};

function MapsSlide({ index }: { index: number }) {
  const src = MAPS_SRC[index] ?? `/service-hero/maps-${index}.png`;
  return (
    <div className="maps-slide">
      <img
        src={src}
        alt=""
        className="maps-slide-img"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const sib = (e.currentTarget as HTMLImageElement)
            .nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = "flex";
        }}
      />
      <div className="maps-slide-fallback" style={{ display: "none" }}>
        <div className="maps-slide-fallback-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21.5s-7-6-7-12a7 7 0 1 1 14 0c0 6-7 12-7 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="maps-slide-fallback-title">Maps screenshot slot</div>
        <code className="maps-slide-fallback-code">/public/service-hero/maps-{index}.png</code>
        <div className="maps-slide-fallback-hint">
          Drop a real Google Maps screenshot here showing the client at #1.
        </div>
      </div>
    </div>
  );
}

function ToolSlide({ index }: { index: number }) {
  if (index === 0) return <ToolPositioning />;
  if (index === 2) return <ToolWeeklyBatch />;
  if (index === 4) return <ToolAIReply />;
  return <ToolMonthlyReport />;
}

function ToolPositioning() {
  const caps = [
    {
      title: "Bilingual AI replies",
      body: "EN + 中文, tuned to your brand voice — never robotic.",
    },
    {
      title: "Weekly request cadence",
      body: "Pacing Google's algorithm actually rewards. No incentives, no gating.",
    },
    {
      title: "Audit-led, not setup-fee-led",
      body: "Free diagnostic first. No $5,000 onboarding gate like Birdeye or Podium.",
    },
  ];
  return (
    <div className="tool-card tool-positioning">
      <div className="tool-positioning-mark">B</div>
      <div className="tool-positioning-brand">BAAM Review</div>
      <div className="tool-positioning-tagline">
        The review platform <em>purpose-built</em> for multilingual local businesses.
      </div>
      <ul className="tool-positioning-list">
        {caps.map((c, i) => (
          <li key={i} className="tool-positioning-item">
            <span className="tool-positioning-check">
              <svg width="11" height="11" viewBox="0 0 12 12">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-5.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              <span className="tool-positioning-item-title">{c.title}</span>
              <span className="tool-positioning-item-body">{c.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="tool-positioning-footer">
        Built for owners · priced for SMB · single-location to multi-location
      </div>
    </div>
  );
}

function ToolWeeklyBatch() {
  const rows = [
    { name: "Maria L.", days: "2 days ago", checked: true },
    { name: "David K.", days: "2 days ago", checked: true },
    { name: "Wei S.", days: "2 days ago", checked: true },
    { name: "Anna T.", days: "2 days ago", checked: true },
    { name: "James P.", days: "3 days ago", checked: false },
  ];
  return (
    <div className="tool-card">
      <div className="tool-card-bar">
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-url">app.baamreview.com / send</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-card-eyebrow">Weekly batch · ready to send</div>
        <div className="tool-card-title">4 customers selected</div>
        <ul className="tool-card-rows">
          {rows.map((r, i) => (
            <li key={i} className={`tool-card-row ${r.checked ? "is-on" : ""}`}>
              <span className="tool-card-check">
                {r.checked ? (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : null}
              </span>
              <span className="tool-card-name">{r.name}</span>
              <span className="tool-card-meta">{r.days}</span>
            </li>
          ))}
        </ul>
        <button className="tool-card-cta" type="button" disabled>
          Send 4 requests →
        </button>
      </div>
    </div>
  );
}

function ToolAIReply() {
  return (
    <div className="tool-card">
      <div className="tool-card-bar">
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-url">app.baamreview.com / replies</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-card-eyebrow">New 5-star review · needs reply</div>
        <div className="tool-card-quote">
          “Dr. Huang really listens. Acupuncture for my back — huge difference.”
          <span className="tool-card-quote-by">— Maria L.</span>
        </div>
        <div className="tool-card-draft">
          <div className="tool-card-draft-label">AI draft · brand tone</div>
          <div className="tool-card-draft-body">
            Thanks Maria — so glad the sessions helped. We’ll see you next month.
          </div>
        </div>
        <div className="tool-card-actions">
          <button type="button" className="tool-card-btn tool-card-btn-ghost" disabled>
            Regenerate
          </button>
          <button type="button" className="tool-card-btn tool-card-btn-solid" disabled>
            Post reply →
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolMonthlyReport() {
  const bars = [3, 5, 4, 7, 6, 9, 8];
  return (
    <div className="tool-card">
      <div className="tool-card-bar">
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-dot" />
        <span className="tool-card-bar-url">app.baamreview.com / report</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-card-eyebrow">Monthly report · May 2026</div>
        <div className="tool-card-stat-row">
          <div className="tool-card-stat">
            <div className="tool-card-stat-num">+28</div>
            <div className="tool-card-stat-label">New reviews</div>
          </div>
          <div className="tool-card-stat">
            <div className="tool-card-stat-num">4.9★</div>
            <div className="tool-card-stat-label">Avg rating</div>
          </div>
          <div className="tool-card-stat">
            <div className="tool-card-stat-num">#1</div>
            <div className="tool-card-stat-label">Maps rank</div>
          </div>
        </div>
        <div className="tool-card-chart">
          {bars.map((h, i) => (
            <span
              key={i}
              className="tool-card-chart-bar"
              style={{ height: `${h * 10}%` }}
            />
          ))}
        </div>
        <div className="tool-card-chart-axis">Mon Tue Wed Thu Fri Sat Sun</div>
      </div>
    </div>
  );
}

const CSS = `
.hero-rotation {
  position: relative;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  font-family: 'Onest', sans-serif;
}
.hero-rotation-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 14px;
  overflow: hidden;
  background: var(--cream-deep, #F5EFE2);
  border: 1px solid var(--border, #E6DECF);
  box-shadow: 0 24px 48px -28px rgba(28, 28, 28, 0.18),
              0 2px 6px -2px rgba(28, 28, 28, 0.06);
}
.hero-rotation-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 600ms ease;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.hero-rotation-slide.is-active {
  opacity: 1;
  pointer-events: auto;
}
.hero-rotation-caption {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-soft, #555);
}
.hero-rotation-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 600;
}
.hero-rotation-badge-maps {
  background: rgba(107, 142, 110, 0.12);
  color: #3F5F4A;
}
.hero-rotation-badge-tool {
  background: rgba(180, 142, 70, 0.14);
  color: #6F5320;
}
.hero-rotation-label { font-weight: 500; color: var(--ink, #1c1c1c); }
.hero-rotation-meta { color: var(--text-muted, #888); }
.hero-rotation-dots {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-start;
}
.hero-rotation-dot {
  width: 22px;
  height: 4px;
  border-radius: 2px;
  border: 0;
  padding: 0;
  background: rgba(28, 28, 28, 0.14);
  cursor: pointer;
  transition: background 200ms ease, width 200ms ease;
}
.hero-rotation-dot.is-active {
  background: var(--ink, #1c1c1c);
  width: 32px;
}

/* ===== maps slide ===== */
.maps-slide { width: 100%; height: 100%; position: relative; }
.maps-slide-img {
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.maps-slide-fallback {
  width: 100%; height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  color: var(--text-muted, #888);
  background: repeating-linear-gradient(
    45deg,
    rgba(180, 142, 70, 0.04) 0px,
    rgba(180, 142, 70, 0.04) 10px,
    transparent 10px,
    transparent 20px
  );
  border-radius: 8px;
}
.maps-slide-fallback-icon { color: var(--gold, #B48E46); }
.maps-slide-fallback-title {
  font-size: 13px; font-weight: 600; color: var(--ink, #1c1c1c);
}
.maps-slide-fallback-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 4px 8px;
  background: rgba(28, 28, 28, 0.06);
  border-radius: 4px;
}
.maps-slide-fallback-hint {
  font-size: 11.5px; max-width: 240px; line-height: 1.45;
}

/* ===== tool slide (generic browser card) ===== */
.tool-card {
  width: 100%; height: 100%;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(28, 28, 28, 0.06);
  box-shadow: 0 2px 8px -3px rgba(28, 28, 28, 0.08);
}
.tool-card-bar {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 12px;
  background: #F4F1EA;
  border-bottom: 1px solid rgba(28, 28, 28, 0.05);
}
.tool-card-bar-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: rgba(28, 28, 28, 0.14);
}
.tool-card-bar-url {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted, #888);
  margin-left: 10px;
}
.tool-card-body {
  flex: 1;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tool-card-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-dark, #6F5320);
  font-weight: 600;
}
.tool-card-title {
  font-family: 'Fraunces', serif;
  font-size: 18px;
  color: var(--ink, #1c1c1c);
  font-weight: 500;
}

/* weekly batch */
.tool-card-rows { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
.tool-card-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #FBF8F1;
  font-size: 12px;
  color: var(--ink, #1c1c1c);
}
.tool-card-row.is-on { background: rgba(107, 142, 110, 0.08); }
.tool-card-check {
  width: 14px; height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(28, 28, 28, 0.18);
  display: inline-flex; align-items: center; justify-content: center;
  background: #fff;
  color: #3F5F4A;
}
.tool-card-row.is-on .tool-card-check {
  background: #3F5F4A; border-color: #3F5F4A; color: #fff;
}
.tool-card-name { flex: 1; font-weight: 500; }
.tool-card-meta { color: var(--text-muted, #888); font-size: 11px; }
.tool-card-cta {
  margin-top: 10px;
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--ink, #1c1c1c);
  color: var(--cream, #FAF7F2);
  border: 0;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: default;
}

/* ai reply */
.tool-card-quote {
  font-family: 'Newsreader', serif;
  font-style: italic;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text, #2a2a2a);
  padding-left: 10px;
  border-left: 2px solid var(--gold, #B48E46);
}
.tool-card-quote-by { display: block; font-size: 11px; color: var(--text-muted, #888); margin-top: 4px; font-style: normal; }
.tool-card-draft {
  background: rgba(180, 142, 70, 0.08);
  border-radius: 6px;
  padding: 10px 12px;
}
.tool-card-draft-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-dark, #6F5320);
  font-weight: 600;
  margin-bottom: 4px;
}
.tool-card-draft-body { font-size: 12.5px; color: var(--ink, #1c1c1c); line-height: 1.5; }
.tool-card-actions { display: flex; gap: 8px; margin-top: 4px; }
.tool-card-btn {
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: default;
  border: 1px solid transparent;
}
.tool-card-btn-ghost { background: transparent; color: var(--text-soft, #555); border-color: rgba(28, 28, 28, 0.14); }
.tool-card-btn-solid { background: var(--ink, #1c1c1c); color: var(--cream, #FAF7F2); }

/* monthly report */
.tool-card-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
.tool-card-stat {
  background: #FBF8F1;
  border-radius: 6px;
  padding: 10px 8px;
  text-align: center;
}
.tool-card-stat-num {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 500;
  color: var(--ink, #1c1c1c);
}
.tool-card-stat-label {
  font-size: 10px;
  color: var(--text-muted, #888);
  margin-top: 2px;
  letter-spacing: 0.04em;
}
.tool-card-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 80px;
  margin-top: 8px;
  padding: 0 4px;
}
.tool-card-chart-bar {
  flex: 1;
  background: linear-gradient(to top, var(--gold, #B48E46), rgba(180, 142, 70, 0.4));
  border-radius: 3px 3px 0 0;
  min-height: 8px;
}
.tool-card-chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--text-muted, #888);
}

/* positioning slide */
.tool-positioning {
  background: linear-gradient(160deg, #FBF8F1 0%, #F1E9D7 100%);
  padding: 26px 26px 22px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
}
.tool-positioning-mark {
  width: 38px; height: 38px;
  background: var(--ink, #1c1c1c);
  color: var(--gold, #B48E46);
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 500;
  margin-bottom: 12px;
}
.tool-positioning-brand {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 500;
  color: var(--ink, #1c1c1c);
  letter-spacing: -0.01em;
}
.tool-positioning-tagline {
  font-family: 'Newsreader', serif;
  font-size: 15px;
  line-height: 1.45;
  color: var(--text, #2a2a2a);
  margin: 6px 0 18px;
}
.tool-positioning-tagline em {
  font-style: italic;
  color: var(--gold-dark, #6F5320);
}
.tool-positioning-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tool-positioning-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--text, #2a2a2a);
}
.tool-positioning-check {
  width: 18px; height: 18px;
  flex: 0 0 18px;
  border-radius: 50%;
  background: var(--ink, #1c1c1c);
  color: var(--gold, #B48E46);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}
.tool-positioning-item-title {
  display: block;
  font-weight: 600;
  color: var(--ink, #1c1c1c);
}
.tool-positioning-item-body {
  display: block;
  margin-top: 1px;
  color: var(--text-soft, #555);
  font-size: 11.5px;
}
.tool-positioning-footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(28, 28, 28, 0.08);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted, #888);
  text-align: center;
}

@media (max-width: 900px) {
  .hero-rotation { max-width: 100%; margin-top: 24px; }
}
`;
