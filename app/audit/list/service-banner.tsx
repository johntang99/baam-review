"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "audit-list-service-banner-dismissed";

interface ServiceBannerProps {
  businessName: string;
  score: number;
  grade: string;
  auditId: string;
}

export function ServiceBanner({
  businessName,
  score,
  grade,
  auditId,
}: ServiceBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(
      typeof window !== "undefined" &&
        sessionStorage.getItem(DISMISS_KEY) === "1",
    );
  }, []);

  if (dismissed) return null;

  // Lift target — pick a reasonable upper bound based on current grade.
  // Matches the bands in lib/audit/templating/data-mapper.ts buildServiceOpportunity.
  const target =
    grade === "F"
      ? `${score + 22}–${score + 32}`
      : grade === "D"
        ? `${score + 18}–${score + 26}`
        : grade === "C"
          ? `${score + 14}–${score + 20}`
          : `${score + 6}–${score + 12}`;

  return (
    <div className="service-banner">
      <span
        className="service-banner-dismiss"
        role="button"
        tabIndex={0}
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
      >
        DISMISS ✕
      </span>
      <div className="service-banner-content">
        <div className="service-banner-tag">
          From your lowest-scoring audit · {businessName}
        </div>
        <h2 className="service-banner-title">
          <span className="business-name">{businessName}</span> scored{" "}
          <em>{score}</em>. BAAM Review Service can take this to{" "}
          <em>{target}</em> in 90 days.
        </h2>
        <p className="service-banner-body">
          Most clients with Grade {grade} reach the next grade up within 90–120
          days of Full Service. Conservative ranges based on aggregate client
          data — full methodology in the service page.
        </p>
        <div className="service-banner-tiers">
          <span>
            <strong>Self-Serve</strong> · $99/mo
          </span>
          <span>·</span>
          <span>
            <strong>Full Service</strong> · $399/mo
          </span>
          <span>·</span>
          <span>30-day free trial · no charge</span>
        </div>
      </div>
      <Link
        href={`/audit/service?audit=${encodeURIComponent(auditId)}`}
        className="service-banner-cta"
      >
        Choose a plan →
      </Link>
    </div>
  );
}
