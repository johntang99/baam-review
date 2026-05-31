"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "audit-service-banner-dismissed";

interface ServiceBannerProps {
  headline: string;
  subhead?: string;
}

export function ServiceBanner({ headline, subhead }: ServiceBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(
      typeof window !== "undefined" &&
        sessionStorage.getItem(DISMISS_KEY) === "1",
    );
  }, []);

  if (dismissed) return null;

  return (
    <div className="service-banner">
      <div className="service-banner-content">
        <div className="service-banner-label">BAAM Review · Service</div>
        <h2
          className="service-banner-headline"
          dangerouslySetInnerHTML={{ __html: headline }}
        />
        {subhead && (
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-mute)",
              marginTop: 8,
            }}
          >
            {subhead}
          </p>
        )}
      </div>
      <div className="service-banner-prices">
        <div className="service-banner-price-row">
          <strong>Self-Serve</strong> · $99/mo · single location
        </div>
        <div className="service-banner-price-row">
          <strong>Full Service</strong> · $399/mo · we run it
        </div>
      </div>
      <a
        href="https://baamreview.com"
        target="_blank"
        rel="noopener noreferrer"
        className="service-banner-cta"
      >
        Learn more →
      </a>
      <span
        className="service-banner-dismiss"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        role="button"
        tabIndex={0}
      >
        Dismiss ✕
      </span>
    </div>
  );
}
