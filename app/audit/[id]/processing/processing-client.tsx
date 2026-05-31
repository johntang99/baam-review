"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "Located your business on Google",
  "Identified your 5 local competitors",
  "Calculated your BAAM Review Score",
  "Projected your 6-month trajectory",
  "Generated your PDF report",
];

interface ProcessingClientProps {
  auditId: string;
}

interface StatusResponse {
  audit_id: string;
  status: "generating" | "complete" | "failed";
  stage: number;
  failed_reason: string | null;
}

export function ProcessingClient({ auditId }: ProcessingClientProps) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [status, setStatus] = useState<StatusResponse["status"]>("generating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/audit/status?id=${auditId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            setError("This audit no longer exists.");
            return;
          }
          throw new Error(`status ${res.status}`);
        }
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;

        setStatus(data.status);
        setStage(data.stage);

        if (data.status === "complete") {
          router.replace(`/audit/${auditId}`);
          return;
        }

        if (data.status === "failed") {
          setError(data.failed_reason ?? "Audit generation failed.");
          return;
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[processing] poll error:", e);
      }

      if (!cancelled) {
        setTimeout(poll, 1000);
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [auditId, router]);

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            color: "#A4452A",
            marginBottom: 16,
          }}
        >
          We hit a snag.
        </div>
        <p
          style={{
            color: "var(--color-text-soft)",
            maxWidth: 480,
            margin: "0 auto 24px",
          }}
        >
          {error}
        </p>
        <a
          href="/audit/new"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "var(--color-forest)",
            color: "var(--color-cream)",
            textDecoration: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Try another business
        </a>
      </div>
    );
  }

  const activeIndex = Math.max(0, Math.min(STAGES.length - 1, stage - 1));

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        § Generating your audit
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 40,
          lineHeight: 1.1,
          color: "var(--color-text)",
          marginBottom: 16,
        }}
      >
        Building your reputation report.
      </h1>
      <p
        style={{
          color: "var(--color-text-soft)",
          fontSize: 16,
          marginBottom: 40,
        }}
      >
        This usually takes 30–60 seconds. We're fetching real-time data from
        Google, comparing against your local competitors, and rendering the PDF.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {STAGES.map((label, idx) => {
          const state =
            idx < activeIndex || status === "complete"
              ? "done"
              : idx === activeIndex && status === "generating"
                ? "active"
                : "pending";
          return (
            <li
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 0",
                borderBottom: "1px solid var(--color-border-soft)",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  background:
                    state === "done"
                      ? "var(--color-forest)"
                      : state === "active"
                        ? "var(--color-paper)"
                        : "var(--color-cream-deep)",
                  color:
                    state === "done"
                      ? "var(--color-cream)"
                      : "var(--color-text-muted)",
                  border:
                    state === "active"
                      ? "2px solid var(--color-forest)"
                      : "1px solid var(--color-border-soft)",
                  flexShrink: 0,
                }}
              >
                {state === "done" ? "✓" : idx + 1}
              </span>
              <span
                style={{
                  fontSize: 15,
                  color:
                    state === "pending"
                      ? "var(--color-text-muted)"
                      : "var(--color-text)",
                  fontWeight: state === "active" ? 500 : 400,
                }}
              >
                {label}
                {state === "active" && (
                  <span
                    style={{
                      marginLeft: 12,
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    working…
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        style={{
          marginTop: 32,
          fontSize: 13,
          color: "var(--color-text-muted)",
          textAlign: "center",
        }}
      >
        Don't close this tab. We'll redirect you when the audit is ready.
      </p>
    </div>
  );
}
