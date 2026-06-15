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
    "Please confirm (or adjust) industry and main service before generating the audit.",
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
  salon_spa: "Salon / spa",
  cafe: "Café / coffee shop",
  apparel: "Apparel / retail",
  health_food: "Health food / supplements",
  insurance: "Insurance agency",
  general_smb: "Other local business",
};

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
    return (
      <form onSubmit={handleGenerate}>
        <div className="state-found" style={{ marginTop: 0 }}>
          <h3 className="found-business-name">{resolved.name}</h3>
          {resolved.name_secondary && (
            <div className="found-business-name-secondary">{resolved.name_secondary}</div>
          )}

          <div className="found-confirmation-grid">
            <div className="found-confirmation-label">Name on Google</div>
            <div className="found-confirmation-value">
              {resolved.name}
              <span className="found-confirmation-value-match">✓ matched</span>
            </div>

            <div className="found-confirmation-label">Address on Google</div>
            <div className="found-confirmation-value">
              {resolved.formatted_address}
              <span className="found-confirmation-value-match">✓ matched</span>
            </div>

            <div className="found-confirmation-label">Website</div>
            <div
              className="found-confirmation-value"
              style={resolved.website_match === "mismatch" ? { color: "var(--rust-deep)" } : undefined}
            >
              {resolved.website_on_google ?? "No website on Google profile"}
              {resolved.website_match === "match" && (
                <span className="found-confirmation-value-match">✓ matches your input</span>
              )}
              {resolved.website_match === "mismatch" && (
                <span className="found-confirmation-value-mismatch">⚠ you entered {website}</span>
              )}
            </div>

            <div className="found-confirmation-label">Google rating</div>
            <div className="found-confirmation-value">
              ★ {resolved.rating.toFixed(1)} · {resolved.total_count} reviews
            </div>
          </div>

          {resolved.google_category && (
            <div
              style={{
                margin: "0 0 14px",
                padding: "10px 14px",
                background: "var(--cream-deep, #EBE3D2)",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--ink-soft)",
                lineHeight: 1.5,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                }}
              >
                On Google Business Profile
              </span>
              <br />
              <strong style={{ color: "var(--ink)" }}>{resolved.google_category}</strong>
              {resolved.google_categories.length > 0 && (
                <> · also {resolved.google_categories.join(", ")}</>
              )}
            </div>
          )}

          <div className="detection-row">
            <div className="detection-item">
              <div className="detection-item-label">Industry</div>
              <select
                value={vertical}
                onChange={(e) => {
                  setVertical(e.target.value);
                  setServiceConfirmed(false);
                }}
                disabled={isPending}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  background: "var(--cream-light, #FAF7F0)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {resolved.vertical_options.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABELS[v] ?? v}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                Drives benchmarks (per-review value, healthy velocity).
              </div>
            </div>

            <div className="detection-item">
              <div className="detection-item-label">Main service</div>
              <input
                type="text"
                value={service}
                onChange={(e) => {
                  setService(e.target.value);
                  setServiceConfirmed(false);
                }}
                disabled={isPending}
                placeholder="e.g., bridal boutique, pediatric dentist"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  background: "var(--cream-light, #FAF7F0)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              />
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                Drives competitor search: <em>&quot;{service.trim() || "—"} {resolved.city}&quot;</em>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              background: "var(--cream-light, #FAF7F0)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "var(--ink-mute)",
                marginBottom: 8,
              }}
            >
              Service decision (GS vs BS)
            </div>
            <div style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
              <div>
                <strong style={{ color: "var(--ink)" }}>GS (Google):</strong> {resolved.gs_service}
              </div>
              <div>
                <strong style={{ color: "var(--ink)" }}>BS (BAAM):</strong> {resolved.bs_service}
              </div>
              <div>
                <strong style={{ color: "var(--ink)" }}>CS (Recommended):</strong>{" "}
                {resolved.cs_recommended_service}{" "}
                <span style={{ color: "var(--ink-mute)" }}>
                  · confidence {(resolved.cs_confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            {resolved.cs_confidence < 0.75 ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#8A4B1F" }}>
                Confidence is moderate. Please review and confirm before generating.
              </div>
            ) : null}
          </div>

          <label
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              color: "var(--ink)",
            }}
          >
            <input
              type="checkbox"
              checked={serviceConfirmed}
              onChange={(e) => setServiceConfirmed(e.target.checked)}
              disabled={isPending}
              style={{ marginTop: 2 }}
            />
            I confirm the selected <strong>Industry</strong> and <strong>Main service</strong>{" "}
            for this audit.
          </label>

          <fieldset
            style={{
              marginTop: 18,
              padding: "14px 16px",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              background: "var(--cream-light, #FAF7F0)",
            }}
          >
            <legend
              style={{
                padding: "0 8px",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--ink-soft)",
              }}
            >
              Report language
            </legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                marginTop: 4,
              }}
            >
              {(
                [
                  {
                    value: "auto",
                    label: "Auto (recommended)",
                    hint: resolved.is_chinese_business
                      ? "中文名稱 detected → English + 繁體中文"
                      : "English only",
                  },
                  { value: "en", label: "English only", hint: "EN PDF + HTML" },
                  { value: "zh", label: "中文 only", hint: "ZH PDF + HTML" },
                  {
                    value: "both",
                    label: "Both English and 中文",
                    hint: "Bilingual: EN + ZH",
                  },
                ] as const
              ).map((opt) => {
                const checked = languageChoice === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 12px",
                      border: `1px solid ${checked ? "var(--ink)" : "var(--rule)"}`,
                      borderRadius: 6,
                      background: checked ? "#fff" : "transparent",
                      cursor: isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="language_choice"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setLanguageChoice(opt.value)}
                      disabled={isPending}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 11,
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
          </fieldset>

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
              disabled={isPending || !service.trim() || !serviceConfirmed}
            >
              {isPending ? "Starting audit…" : "Generate audit →"}
            </button>
          </div>
        </div>
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
