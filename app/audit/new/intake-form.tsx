"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IntakeFormProps {
  initialError?: string;
}

const ERROR_LABELS: Record<string, string> = {
  empty: "Please enter your business details.",
  missing_fields: "Business name and address are both required.",
  NOT_FOUND: "We couldn't find that business on Google. Check the name and address — try a different city if needed.",
  NO_REVIEWS: "That business has no reviews yet on Google — we can't audit it.",
  monthly_limit: "You've used your 2 audits for this month. Quota resets on the 1st.",
  lifetime_limit: "You've reached your lifetime audit allowance.",
  unauthorized: "You need to sign in again to continue.",
  service_confirmation_required:
    "Please confirm (or adjust) Industry and RS (Recommended service) before generating the audit.",
  email_not_verified:
    "Please verify your email first — check your inbox for the verification link, then refresh this page.",
};

const VERTICAL_LABELS: Record<string, string> = {
  tcm_clinic: "TCM clinic / acupuncture",
  dental: "Dental clinic",
  legal_immigration: "Law firm / immigration",
  restaurant: "Restaurant / food service",
  real_estate: "Real estate agency",
  hotel: "Hotel / lodging",
  auto: "Auto services / repair",
  contractor: "Contractor / home services",
  manufacturer_industrial: "Manufacturer / industrial",
  salon_spa: "Salon / spa",
  cafe: "Café / coffee shop",
  apparel: "Apparel / retail",
  health_food: "Health food / supplements",
  insurance: "Insurance agency",
  optometry_vision: "Optometry / vision services",
  general_smb: "Other local business",
};

const CANDIDATE_SOURCE_LABELS: Record<string, string> = {
  seed: "Seed",
  vertical_prior: "Industry prior",
  google_category_display: "Google category label",
  google_primary_type: "Google primary type",
  detail_vision: "Vision detail rule",
  detail_manufacturer: "Manufacturer detail rule",
  detail_retail: "Retail detail rule",
  name_match: "Name match",
  description_match: "GBP description match",
  website_match: "Website signal match",
  category_match: "Category token match",
};

interface ServiceCandidateDebug {
  service: string;
  score: number;
  confidence: number;
  specificity: number;
  sources: string[];
}

interface ServiceShadowDebug {
  enabled: boolean;
  mode?: "distilled" | "llm";
  recommended_service?: string;
  confidence?: number;
  agrees_with_system?: boolean;
}

interface ResolvedBusiness {
  place_id: string;
  name: string;
  name_secondary: string | null;
  formatted_address: string;
  city: string;
  state: string;
  zip: string;
  website_on_google: string | null;
  rating: number;
  total_count: number;
  last_review_days_ago: number | null;
  is_chinese_business: boolean;
  detected_vertical: string;
  detected_service: string;
  gs_service: string;
  bs_service: string;
  cs_recommended_service: string;
  cs_confidence: number;
  cs_reason_codes: string[];
  service_candidates?: ServiceCandidateDebug[];
  service_shadow?: ServiceShadowDebug;
  google_category: string | null;
  google_categories: string[];
  vertical_options: string[];
  website_match: "match" | "mismatch" | "no_user_input" | "no_google_data";
}

export function IntakeForm({ initialError }: IntakeFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [resolved, setResolved] = useState<ResolvedBusiness | null>(null);
  const [vertical, setVertical] = useState("");
  const [service, setService] = useState("");
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [languageChoice, setLanguageChoice] =
    useState<"auto" | "en" | "zh" | "both">("auto");
  const [isPending, setIsPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [shakeField, setShakeField] = useState<"address" | "website" | null>(null);
  const [showConfirmReminder, setShowConfirmReminder] = useState(false);

  const error = localError ?? initialError ?? null;

  function flash(field: "address" | "website") {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 1500);
  }

  function verifyAddress() {
    if (!address.trim()) {
      flash("address");
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`,
      "_blank",
      "noopener",
    );
  }

  function verifyWebsite() {
    let w = website.trim();
    if (!w) {
      flash("website");
      return;
    }
    if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
    window.open(w, "_blank", "noopener");
  }

  async function handleFind(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim() || !address.trim()) {
      setLocalError("Business name and address are required.");
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/audit/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          website: website.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = (data?.error ?? "") as string;
        setLocalError(ERROR_LABELS[code] ?? code ?? "Couldn't resolve the business.");
        setIsPending(false);
        return;
      }
      setResolved(data);
      setVertical(data.detected_vertical);
      setService(data.cs_recommended_service || data.detected_service);
      setServiceConfirmed(false);
      setStep("confirm");
    } catch (err) {
      console.error("[intake] resolve failed:", err);
      setLocalError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resolved) return;
    if (!serviceConfirmed) {
      setShowConfirmReminder(true);
      return;
    }
    setLocalError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: resolved.place_id,
          vertical_override: vertical,
          service_override: service.trim(),
          language_choice: languageChoice,
          gs_service: resolved.gs_service,
          bs_service: resolved.bs_service,
          cs_recommended_service: resolved.cs_recommended_service,
          cs_confidence: resolved.cs_confidence,
          cs_reason_codes: resolved.cs_reason_codes,
          service_shadow: resolved.service_shadow,
          service_confirmed: serviceConfirmed,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const label = body.error ? ERROR_LABELS[body.error] ?? body.error : "Something went wrong. Try again.";
        setLocalError(label);
        setIsPending(false);
        return;
      }
      const { audit_id } = (await res.json()) as { audit_id: string };
      router.push(`/audit/${audit_id}/processing`);
    } catch (err) {
      console.error("[intake] generate failed:", err);
      setLocalError("Couldn't reach the server. Check your connection and try again.");
      setIsPending(false);
    }
  }

  if (step === "confirm" && resolved) {
    const flowSteps = [
      {
        title: "Match GBP profile",
        desc: "Confirm Name, Address, Website, and Rating from Google.",
      },
      {
        title: "Choose report language",
        desc: "Select output language for this audit report.",
      },
      {
        title: "Set final service",
        desc: "Use Google and BAAM evidence, then finalize the Recommended Service.",
      },
      {
        title: "Confirm and generate",
        desc: "Check confirmation, then generate the audit.",
      },
    ] as const;

    const languageOptions = [
      {
        value: "auto" as const,
        label: "Auto (recommended)",
        hint: resolved.is_chinese_business
          ? "Chinese detected -> English + Traditional Chinese"
          : "English only",
      },
      { value: "en" as const, label: "English only", hint: "EN PDF + HTML" },
      { value: "zh" as const, label: "Chinese only", hint: "ZH PDF + HTML" },
      {
        value: "both" as const,
        label: "Both English and Chinese",
        hint: "Bilingual: EN + ZH",
      },
    ];

    const confidencePct = Math.round(resolved.cs_confidence * 100);
    const isModerateConfidence = resolved.cs_confidence < 0.75;
    const finalService = service.trim() || "—";
    const topServiceCandidates = resolved.service_candidates ?? [];
    const serviceValueDisplayStyle = {
      fontSize: 24,
      lineHeight: 1.12,
      fontFamily: "'Instrument Serif', serif",
      fontWeight: 400,
      color: "var(--ink)",
    } as const;
    const stepCircleStyle = {
      width: 28,
      height: 28,
      borderRadius: 999,
      background: "var(--ink)",
      color: "var(--cream-light)",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    } as const;

    return (
      <form onSubmit={handleGenerate}>
        <div className="state-found" style={{ marginTop: 0, borderColor: "var(--rule)" }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Instrument Serif', serif",
              fontSize: 42,
              lineHeight: 1.05,
              color: "var(--ink)",
            }}
          >
            Determine Service and Report Language
          </h3>
          <p
            style={{
              marginTop: 12,
              maxWidth: 840,
              fontSize: 16,
              lineHeight: 1.5,
              color: "var(--ink-soft)",
            }}
          >
            This page shows Google Service and BAAM-generated Service as evidence,
            then lets you confirm the Recommended Service before generating the audit.
          </p>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {flowSteps.map((stepItem, index) => (
              <div
                key={stepItem.title}
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: 8,
                  background: "var(--cream-light)",
                  padding: "11px 11px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: "var(--ink)",
                      color: "var(--cream-light)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink)",
                      fontWeight: 700,
                    }}
                  >
                    {stepItem.title}
                  </span>
                </div>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    lineHeight: 1.35,
                    color: "var(--ink-mute)",
                  }}
                >
                  {stepItem.desc}
                </p>
              </div>
            ))}
          </div>

          <section
            style={{
              marginTop: 18,
              border: "1px solid var(--rule)",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--ink-mute)",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={stepCircleStyle}>1</span>
              <span>GBP matched profile</span>
            </h4>
            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--rule-soft)",
                borderRadius: 10,
                background: "var(--cream-light)",
                padding: 14,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--sage-deep)",
                  color: "var(--cream-light)",
                  borderRadius: 999,
                  padding: "3px 9px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                ✓ Found · Match confirmed
              </span>
              <h5
                style={{
                  margin: "10px 0 0",
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 34,
                  lineHeight: 1.08,
                  color: "var(--ink)",
                }}
              >
                {resolved.name}
              </h5>
              {resolved.name_secondary ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 16,
                    color: "var(--ink-mute)",
                    fontStyle: "italic",
                  }}
                >
                  {resolved.name_secondary}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                    paddingTop: 3,
                  }}
                >
                  Name on Google
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.35,
                    fontFamily: "'Instrument Serif', serif",
                    color: "var(--ink)",
                  }}
                >
                  {resolved.name}
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--sage-deep)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                    }}
                  >
                    ✓ matched
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                    paddingTop: 3,
                  }}
                >
                  Address on Google
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.35,
                    fontFamily: "'Instrument Serif', serif",
                    color: "var(--ink)",
                  }}
                >
                  {resolved.formatted_address}
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--sage-deep)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                    }}
                  >
                    ✓ matched
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                    paddingTop: 3,
                  }}
                >
                  Website
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.35,
                    fontFamily: "'Instrument Serif', serif",
                    color:
                      resolved.website_match === "mismatch"
                        ? "var(--rust-deep)"
                        : "var(--ink)",
                  }}
                >
                  {resolved.website_on_google ?? "No website on Google profile"}
                  {resolved.website_match === "match" ? (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--sage-deep)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        fontWeight: 700,
                      }}
                    >
                      ✓ matched
                    </span>
                  ) : null}
                  {resolved.website_match === "mismatch" ? (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--rust-deep)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        fontWeight: 700,
                      }}
                    >
                      ⚠ input: {website || "N/A"}
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                    paddingTop: 3,
                  }}
                >
                  Google rating
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.35,
                    fontFamily: "'Instrument Serif', serif",
                    color: "var(--ink)",
                  }}
                >
                  ★ {resolved.rating.toFixed(1)} · {resolved.total_count} reviews
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              marginTop: 14,
              border: "1px solid var(--rule)",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--ink-mute)",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={stepCircleStyle}>2</span>
              <span>Report language</span>
            </h4>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {languageOptions.map((opt) => {
                const checked = languageChoice === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      border: `1px solid ${checked ? "var(--ink)" : "var(--rule)"}`,
                      borderRadius: 8,
                      background: checked ? "#fff" : "var(--cream-light)",
                      padding: "11px 12px",
                      cursor: isPending ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <input
                      type="radio"
                      name="language_choice"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setLanguageChoice(opt.value)}
                      disabled={isPending}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          marginTop: 2,
                          display: "block",
                          fontSize: 12,
                          color: "var(--ink-mute)",
                        }}
                      >
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section
            style={{
              marginTop: 14,
              border: "1px solid var(--rule)",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={stepCircleStyle}>3</span>
                <span>Service evidence and recommended service</span>
              </h4>
              <span
                style={{
                  border: "1px solid #e1c89f",
                  color: "var(--amber-deep)",
                  background: "#fbf0df",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Confidence {confidencePct}% {isModerateConfidence ? "· Moderate" : ""}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <article
                style={{
                  border: "1px solid var(--rule-soft)",
                  borderRadius: 8,
                  padding: 12,
                  background: "var(--cream-light)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                  }}
                >
                  Google Service
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 24,
                    lineHeight: 1.12,
                    fontFamily: "'Instrument Serif', serif",
                    color: "var(--ink)",
                    textTransform: "lowercase",
                  }}
                >
                  {resolved.gs_service}
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-soft)" }}>
                  From Google Business Profile category signals.
                </p>
              </article>

              <article
                style={{
                  border: "1px solid var(--rule-soft)",
                  borderRadius: 8,
                  padding: 12,
                  background: "var(--cream-light)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                  }}
                >
                  BAAM-generated Service
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 24,
                    lineHeight: 1.12,
                    fontFamily: "'Instrument Serif', serif",
                    color: "var(--ink)",
                    textTransform: "lowercase",
                  }}
                >
                  {resolved.bs_service}
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-soft)" }}>
                  From BAAM vertical and keyword inference rules.
                </p>
              </article>
            </div>

            {topServiceCandidates.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  border: "1px dashed var(--rule)",
                  borderRadius: 8,
                  padding: 12,
                  background: "#faf9f6",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                  }}
                >
                  Debug · Top candidates (up to 3)
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {topServiceCandidates.map((candidate, index) => (
                    <article
                      key={`${candidate.service}-${index}`}
                      style={{
                        border: "1px solid var(--rule-soft)",
                        borderRadius: 8,
                        padding: 10,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          fontWeight: 700,
                        }}
                      >
                        #{index + 1} candidate
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          ...serviceValueDisplayStyle,
                          textTransform: "lowercase",
                        }}
                      >
                        {candidate.service}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--ink-soft)",
                        }}
                      >
                        score {candidate.score.toFixed(2)} · confidence{" "}
                        {Math.round(candidate.confidence * 100)}% · specificity{" "}
                        {candidate.specificity}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {candidate.sources.map((source) => (
                          <span
                            key={source}
                            style={{
                              border: "1px solid var(--rule-soft)",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              color: "var(--ink-mute)",
                              background: "var(--cream-light)",
                            }}
                          >
                            {CANDIDATE_SOURCE_LABELS[source] ?? source}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--sage-deep)",
                background: "#e8f0e8",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--sage-deep)",
                }}
              >
                Recommended Service (final audit input)
              </div>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                Edit if needed. This exact value is used for competitor query and
                final audit generation.
              </p>

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-mute)",
                      fontWeight: 700,
                    }}
                  >
                    Industry
                  </div>
                  <select
                    value={vertical}
                    onChange={(e) => {
                      setVertical(e.target.value);
                      setServiceConfirmed(false);
                      setShowConfirmReminder(false);
                    }}
                    disabled={isPending}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "8px 12px",
                      border: "1px solid var(--rule)",
                      borderRadius: 8,
                      background: "#fff",
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: 24,
                      lineHeight: 1.12,
                      fontWeight: 400,
                      color: "var(--ink)",
                    }}
                  >
                    {resolved.vertical_options.map((v) => (
                      <option key={v} value={v}>
                        {VERTICAL_LABELS[v] ?? v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-mute)",
                      fontWeight: 700,
                    }}
                  >
                    Recommended Service
                  </div>
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => {
                      setService(e.target.value);
                      setServiceConfirmed(false);
                      setShowConfirmReminder(false);
                    }}
                    disabled={isPending}
                    placeholder="e.g., bridal boutique, pediatric dentist"
                    style={{
                      width: "100%",
                      marginTop: 6,
                      border: "1px solid var(--rule)",
                      background: "#fff",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 24,
                      lineHeight: 1.12,
                      fontFamily: "'Instrument Serif', serif",
                      fontWeight: 400,
                      color: "var(--ink)",
                      textTransform: "lowercase",
                    }}
                  />
                </div>
              </div>

              {isModerateConfidence ? (
                <div
                  style={{
                    marginTop: 10,
                    border: "1px solid #e1c89f",
                    background: "#fbf0df",
                    borderRadius: 8,
                    padding: "10px 11px",
                    color: "var(--amber-deep)",
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  Confidence is moderate. You can refine the Recommended Service
                  to improve service accuracy. Confirm it before generating the audit.
                </div>
              ) : null}
            </div>
          </section>

          <section
            style={{
              marginTop: 14,
              border: "1px solid var(--rule)",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--ink-mute)",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={stepCircleStyle}>4</span>
              <span>Confirmation gate</span>
            </h4>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 14,
              }}
            >
              <div
                style={{
                  border: "1px solid var(--rule-soft)",
                  background: "#fff",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 14,
                    color: "var(--ink)",
                    lineHeight: 1.35,
                  }}
                >
                  <input
                    id="service-confirm-checkbox"
                    type="checkbox"
                    checked={serviceConfirmed}
                    onChange={(e) => {
                      setServiceConfirmed(e.target.checked);
                      if (e.target.checked) setShowConfirmReminder(false);
                    }}
                    disabled={isPending}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    I confirm the selected <strong>Industry</strong> and{" "}
                    <strong>Recommended Service</strong> for this audit.
                  </span>
                </label>
              </div>

              <div
                style={{
                  border: "1px solid var(--rule-soft)",
                  borderRadius: 8,
                  padding: 12,
                  background: "var(--cream-light)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                  Final service used now: <b>{finalService}</b>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  Generate is blocked until confirmation is checked.
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 18,
                padding: "12px 16px",
                background: "rgba(164, 69, 42, 0.08)",
                border: "1px solid rgba(164, 69, 42, 0.3)",
                color: "#842F1B",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <div className="found-action-row">
            <button
              type="button"
              className="found-action-edit"
              onClick={() => {
                setStep("input");
                setResolved(null);
                setLocalError(null);
              }}
              disabled={isPending}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              ← Not the right business? Edit your details
            </button>
            <button
              type="submit"
              className="found-action-generate"
              disabled={isPending || !service.trim()}
            >
              {isPending ? "Starting audit…" : "Generate audit →"}
            </button>
          </div>
        </div>
        {showConfirmReminder && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-reminder-title"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(14, 22, 30, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 60,
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                borderRadius: 10,
                border: "1px solid var(--rule)",
                background: "var(--paper, #fff)",
                boxShadow: "0 20px 45px rgba(9, 15, 22, 0.22)",
                padding: "18px 20px",
              }}
            >
              <h3
                id="confirm-reminder-title"
                style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}
              >
                Please confirm before generating
              </h3>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>
                Review Industry and Recommended Service, then check the confirmation box to continue.
              </p>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowConfirmReminder(false)}
                  style={{
                    border: "1px solid var(--rule)",
                    borderRadius: 8,
                    background: "var(--paper, #fff)",
                    color: "var(--ink)",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmReminder(false);
                    document
                      .getElementById("service-confirm-checkbox")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  style={{
                    border: "1px solid var(--ink)",
                    borderRadius: 8,
                    background: "var(--ink)",
                    color: "var(--cream, #f8f4ea)",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Go to confirmation
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleFind}>
      <div className="field-row">
        <label className="field-label" htmlFor="business-name">
          Business name
          <span className="field-required">· required</span>
        </label>
        <input
          type="text"
          className="field-input"
          id="business-name"
          name="business-name"
          placeholder="Your business name"
          autoComplete="organization"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        <div className="field-helper">
          Exact name as it appears on Google. Capitalization and punctuation matter.
        </div>
      </div>

      <div className="field-row">
        <label className="field-label" htmlFor="business-address">
          Business address
          <span className="field-required">· required</span>
        </label>
        <div className="field-input-row">
          <input
            type="text"
            className="field-input"
            id="business-address"
            name="business-address"
            placeholder="e.g., 136-40 39th Avenue, Flushing NY 11354"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isPending}
            style={shakeField === "address" ? { borderColor: "#A4452A" } : undefined}
          />
          <button
            type="button"
            className="verify-button"
            onClick={verifyAddress}
            disabled={isPending}
          >
            View on Google Maps
            <span className="verify-button-arrow">↗</span>
          </button>
        </div>
        <div className="field-helper">
          Full street address including city, state, and zip. Click the button to open Google Maps in a new tab and confirm we&apos;ve got the right place.
        </div>
      </div>

      <div className="field-row">
        <label className="field-label" htmlFor="business-website">
          Website
          <span className="field-optional">· recommended</span>
        </label>
        <div className="field-input-row">
          <input
            type="text"
            className="field-input"
            id="business-website"
            name="business-website"
            placeholder="e.g., modtcmcenter.com"
            autoComplete="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={isPending}
            style={shakeField === "website" ? { borderColor: "#A4452A" } : undefined}
          />
          <button
            type="button"
            className="verify-button"
            onClick={verifyWebsite}
            disabled={isPending}
          >
            Open website
            <span className="verify-button-arrow">↗</span>
          </button>
        </div>
        <div className="field-helper">
          Helps us confirm we matched the right business. Skip if your business has no website — we&apos;ll match on name + address only.
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "rgba(164, 69, 42, 0.08)",
            border: "1px solid rgba(164, 69, 42, 0.3)",
            color: "#842F1B",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div className="input-block-submit-row">
        <div className="input-block-submit-info">
          {isPending
            ? "Looking up your business on Google…"
            : "We'll find your business and show you what we detected before generating the audit."}
        </div>
        <button
          type="submit"
          className="submit-btn-find"
          disabled={isPending}
        >
          {isPending ? "Finding…" : "Find my business →"}
        </button>
      </div>
    </form>
  );
}
