"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";

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
  specific_service_required:
    "Please choose a specific service before generating the audit.",
  specific_service_selection_required:
    "Please pick one service from the suggested specific service options.",
  competitor_selection_required:
    "Please generate competitors and select at least one before generating the audit.",
  competitor_selection_stale:
    "Service changed after competitor preview. Please regenerate competitors before generating the audit.",
  competitor_preview_in_progress:
    "Competitor data is still loading. Please wait until hydration completes.",
  competitor_preview_failed:
    "Competitor hydration did not complete. Please regenerate competitors.",
  competitor_scenario_missing:
    "Competitor preview session expired. Please regenerate competitors.",
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
  llm_analyst: "LLM analyst",
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
  llm_provider?: string;
  llm_model?: string;
  llm_fallback_used?: boolean;
  recommended_service?: string;
  llm_service_phrase?: string;
  llm_phrase_candidates?: string[];
  confidence?: number;
  agrees_with_system?: boolean;
}

interface PrimaryAnalystDebug {
  enabled: boolean;
  mode?: "distilled" | "llm";
  llm_provider?: string;
  llm_model?: string;
  llm_fallback_used?: boolean;
  recommended_service?: string;
  llm_service_phrase?: string;
  llm_phrase_candidates?: string[];
  confidence?: number;
  rationale?: string;
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
  service_options?: string[];
  needs_service_selection?: boolean;
  llm_service_candidates?: string[];
  llm_service_phrases?: string[];
  primary_analyst?: PrimaryAnalystDebug;
  service_shadow?: ServiceShadowDebug;
  service_model_debug?: {
    primary?: {
      mode?: "distilled" | "llm";
      provider?: string;
      model?: string;
      fallback_used?: boolean;
    } | null;
    shadow?: {
      mode?: "distilled" | "llm";
      provider?: string;
      model?: string;
      fallback_used?: boolean;
    } | null;
  };
  google_category: string | null;
  google_categories: string[];
  vertical_options: string[];
  website_match: "match" | "mismatch" | "no_user_input" | "no_google_data";
}

interface CompetitorPreviewItem {
  rank: number;
  place_id: string | null;
  name: string;
  city: string | null;
  rating: number | null;
  total_count: number;
  distance_miles: number | null;
  primary_category: string | null;
}

interface CompetitorPreviewResult {
  fast_mode?: boolean;
  scenario_id: string | null;
  scenario_expires_at?: string | null;
  status?: "ready" | "hydrating" | "failed";
  total_competitors?: number;
  hydrated_competitors?: number;
  failed_competitors?: number;
  duration_ms?: number;
  cache_stats?: {
    total: number;
    cache_hits: number;
    cache_misses: number;
    degraded_results: number;
    cache_hit_ratio_pct: number;
  };
  hydration_guardrail?: {
    pending_competitors: number;
    estimated_remaining_ms: number;
    estimated_ready_total_ms: number;
    warning_threshold_ms: number;
    critical_threshold_ms: number;
    warning_level: "none" | "warning" | "critical";
    service_switch_overlap_count: number | null;
    low_overlap_service_switch: boolean;
    low_overlap_prewarm_triggered?: boolean;
  };
  generated_at: string;
  service_override: string;
  search_metadata: {
    primary_keyword: string;
    primary_service_keyword?: string;
    keyword_variants?: string[];
    fallback_keyword_variants?: string[];
    fallback_reason?: string;
    radius_used_miles: number;
    total_candidates_found: number;
    candidates_excluded: number;
    discovery_pool_size?: number;
    strict_pool_size?: number;
  };
  competitors: CompetitorPreviewItem[];
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
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [fastCompetitorMode, setFastCompetitorMode] = useState(true);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [competitorPreview, setCompetitorPreview] =
    useState<CompetitorPreviewResult | null>(null);
  const [competitorPreviewError, setCompetitorPreviewError] = useState<string | null>(null);
  const [selectedPreviewCompetitorPlaceIds, setSelectedPreviewCompetitorPlaceIds] =
    useState<string[]>([]);
  const [isHydrationPolling, setIsHydrationPolling] = useState(false);
  const hydrationPollAbortRef = useRef<AbortController | null>(null);

  const error = localError ?? initialError ?? null;

  useEffect(() => {
    const scenarioId = competitorPreview?.scenario_id;
    const status = competitorPreview?.status;
    if (!scenarioId || status !== "hydrating") {
      setIsHydrationPolling(false);
      return;
    }

    let isCancelled = false;
    setIsHydrationPolling(true);

    const poll = async () => {
      hydrationPollAbortRef.current?.abort();
      const controller = new AbortController();
      hydrationPollAbortRef.current = controller;
      try {
        const res = await fetch(
          `/api/audit/competitors/scenario?scenario_id=${encodeURIComponent(scenarioId)}`,
          { signal: controller.signal },
        );
        const body = (await res.json().catch(() => ({}))) as
          | CompetitorPreviewResult
          | { error?: string };
        if (isCancelled) return;
        if (!res.ok) {
          const code = "error" in body ? String(body.error ?? "") : "";
          setCompetitorPreviewError(
            ERROR_LABELS[code] ??
              code ??
              "Competitor hydration status could not be loaded. Please regenerate.",
          );
          setIsHydrationPolling(false);
          return;
        }
        const next = body as CompetitorPreviewResult;
        setCompetitorPreview((prev) => {
          if (!prev) return next;
          return {
            ...prev,
            ...next,
            hydration_guardrail: next.hydration_guardrail
              ? {
                  ...(prev.hydration_guardrail ?? {}),
                  ...next.hydration_guardrail,
                }
              : prev.hydration_guardrail,
            generated_at: next.generated_at || prev.generated_at,
            service_override: next.service_override || prev.service_override,
          };
        });
        if (next.status && next.status !== "hydrating") {
          setIsHydrationPolling(false);
        }
      } catch (err) {
        if (isCancelled) return;
        console.error("[intake] scenario poll failed:", err);
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(timer);
      hydrationPollAbortRef.current?.abort();
      setIsHydrationPolling(false);
    };
  }, [competitorPreview?.scenario_id, competitorPreview?.status]);

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
      const suggestedSpecificService =
        Array.isArray(data.service_options) && data.service_options.length > 0
          ? String(data.service_options[0] || "").trim()
          : "";
      const fallbackService =
        String(data.cs_recommended_service || data.detected_service || "").trim();
      setService(
        data.needs_service_selection
          ? suggestedSpecificService || fallbackService
          : fallbackService,
      );
      setShowAllSuggestions(false);
      setServiceConfirmed(false);
      setCompetitorPreview(null);
      setCompetitorPreviewError(null);
      setSelectedPreviewCompetitorPlaceIds([]);
      setStep("confirm");
    } catch (err) {
      console.error("[intake] resolve failed:", err);
      setLocalError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleGenerateCompetitors() {
    if (!resolved) return;
    const serviceOverride = service.trim();
    if (!serviceOverride) {
      setCompetitorPreviewError("Please enter a service before generating competitors.");
      return;
    }

    setCompetitorPreviewError(null);
    setIsPreviewPending(true);
    try {
      const previousCompetitorPlaceIds = (competitorPreview?.competitors ?? [])
        .map((item) => item.place_id)
        .filter((value): value is string => Boolean(value));
      const res = await fetch("/api/audit/competitors/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: resolved.place_id,
          service_override: serviceOverride,
          count: 7,
          fast_mode: fastCompetitorMode,
          previous_competitor_place_ids: previousCompetitorPlaceIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | CompetitorPreviewResult
        | { error?: string };
      if (!res.ok) {
        const code = "error" in data ? (data.error ?? "") : "";
        setCompetitorPreviewError(
          ERROR_LABELS[code] ?? code ?? "Couldn't generate competitors right now.",
        );
        return;
      }
      const preview = data as CompetitorPreviewResult;
      setCompetitorPreview(preview);
      setSelectedPreviewCompetitorPlaceIds(
        preview.competitors
          .map((item) => item.place_id)
          .filter((value): value is string => Boolean(value)),
      );
    } catch (err) {
      console.error("[intake] competitors preview failed:", err);
      setCompetitorPreviewError(
        "Couldn't reach the server while generating competitors. Please try again.",
      );
    } finally {
      setIsPreviewPending(false);
    }
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resolved) return;
    if (!serviceConfirmed) {
      setShowConfirmReminder(true);
      return;
    }
    if (isBroadServiceInput(service.trim(), vertical)) {
      setLocalError(
        "Please select a specific service. Broad labels are blocked for audit generation.",
      );
      return;
    }
    const previewIsStaleForGenerate =
      !!competitorPreview &&
      normalizePreviewService(service) !==
        normalizePreviewService(competitorPreview.service_override);
    const selectedCompetitorPlaceIdsForGenerate = previewIsStaleForGenerate
      ? []
      : selectedPreviewCompetitorPlaceIds;
    if (!competitorPreview) {
      setLocalError(
        "Please generate competitors before generating the audit.",
      );
      return;
    }
    if (previewIsStaleForGenerate) {
      setLocalError(
        "Service changed after competitor preview. Please regenerate competitors before generating the audit.",
      );
      return;
    }
    if (competitorPreview.status === "hydrating") {
      setLocalError(ERROR_LABELS.competitor_preview_in_progress);
      return;
    }
    if (competitorPreview.status === "failed") {
      setLocalError(ERROR_LABELS.competitor_preview_failed);
      return;
    }
    if (selectedCompetitorPlaceIdsForGenerate.length === 0) {
      setLocalError(
        "Please select at least one competitor before generating the audit.",
      );
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
          needs_service_selection: resolved.needs_service_selection,
          service_options: resolved.service_options ?? [],
          service_shadow: resolved.service_shadow,
          service_confirmed: serviceConfirmed,
          selected_competitor_place_ids: selectedCompetitorPlaceIdsForGenerate,
          competitor_scenario_id: competitorPreview.scenario_id,
          preview_service_override: competitorPreview.service_override,
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
    const normalizedCurrentService = normalizePreviewService(service);
    const normalizedPreviewService = normalizePreviewService(
      competitorPreview?.service_override ?? "",
    );
    const previewIsStale =
      !!competitorPreview &&
      !!normalizedCurrentService &&
      normalizedCurrentService !== normalizedPreviewService;
    const previewGeneratedAt = competitorPreview?.generated_at
      ? new Date(competitorPreview.generated_at)
      : null;
    const previewGeneratedLabel =
      previewGeneratedAt && !Number.isNaN(previewGeneratedAt.getTime())
        ? previewGeneratedAt.toLocaleTimeString()
        : "";
    const selectablePreviewPlaceIds = (competitorPreview?.competitors ?? [])
      .map((item) => item.place_id)
      .filter((value): value is string => Boolean(value));
    const selectedPreviewPlaceIdSet = new Set(selectedPreviewCompetitorPlaceIds);
    const selectedPreviewCount = selectablePreviewPlaceIds.filter((value) =>
      selectedPreviewPlaceIdSet.has(value),
    ).length;
    const hydrationGuardrail = competitorPreview?.hydration_guardrail;
    const topServiceCandidates = resolved.service_candidates ?? [];
    const serviceOptions = resolved.service_options ?? [];
    const llmServiceCandidates = resolved.llm_service_candidates ?? [];
    const llmServicePhrases = resolved.llm_service_phrases ?? [];
    const llmSuggestedServiceOptions = Array.from(
      new Set(
        [...llmServicePhrases, ...llmServiceCandidates]
          .map((candidate) => String(candidate || "").trim())
          .filter(Boolean),
      ),
    );
    const suggestedServiceOptions = Array.from(
      new Set(
        [...serviceOptions, ...llmSuggestedServiceOptions]
          .map((option) => String(option || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 8);
    const primaryModelDebug = resolved.service_model_debug?.primary ?? null;
    const shadowModelDebug = resolved.service_model_debug?.shadow ?? null;
    const formatModelDebug = (
      label: string,
      debug:
        | {
            mode?: "distilled" | "llm";
            provider?: string;
            model?: string;
            fallback_used?: boolean;
          }
        | null
        | undefined,
    ) => {
      if (!debug) return "";
      const mode = debug.mode ? String(debug.mode) : "unknown";
      const provider = debug.provider ? String(debug.provider) : "n/a";
      const model = debug.model ? String(debug.model) : "n/a";
      const fallback = debug.fallback_used ? "yes" : "no";
      return `${label}: mode=${mode}, provider=${provider}, model=${model}, fallback=${fallback}`;
    };
    const primaryModelDebugLine = formatModelDebug("Primary", primaryModelDebug);
    const shadowModelDebugLine = formatModelDebug("Shadow", shadowModelDebug);
    const serviceValueDisplayStyle = {
      fontSize: 16,
      lineHeight: 1.3,
      fontFamily: "inherit",
      fontWeight: 500,
      color: "var(--ink)",
    } as const;
    const stepCircleStyle = {
      width: 28,
      height: 28,
      borderRadius: 999,
      background: "var(--ink)",
      color: "var(--cream-light)",
      fontSize: 12,
      fontWeight: 700,
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
              fontFamily: "inherit",
              fontSize: 32,
              lineHeight: 1.2,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            Confirm Service and Report Language
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
            Confirm the final service and report language before generating your audit.
          </p>

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
                  fontFamily: "inherit",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                ✓ Found · Match confirmed
              </span>
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
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
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontFamily: "inherit",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {resolved.name}
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--sage-deep)",
                      fontFamily: "inherit",
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
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
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
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontFamily: "inherit",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {resolved.formatted_address}
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--sage-deep)",
                      fontFamily: "inherit",
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
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
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
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontFamily: "inherit",
                    fontWeight: 500,
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
                        fontFamily: "inherit",
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
                        fontFamily: "inherit",
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
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
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
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontFamily: "inherit",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  ★ {resolved.rating.toFixed(1)} · {resolved.total_count} reviews
                </div>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="found-action-edit"
            onClick={() => {
              setStep("input");
              setResolved(null);
              setLocalError(null);
            }}
            disabled={isPending}
            style={{
              marginTop: 10,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            ← Not the right business? Edit your details
          </button>

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
                      {checked ? (
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
                      ) : null}
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
                <span>Final service selection and competitor generation</span>
              </h4>
              {isModerateConfidence ? (
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
                  Confidence {confidencePct}% · Needs review
                </span>
              ) : null}
            </div>

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
                  fontFamily: "inherit",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                }}
              >
                Model evidence
              </div>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                Google: <b style={{ color: "var(--ink)" }}>{resolved.gs_service}</b> · BAAM:{" "}
                <b style={{ color: "var(--ink)" }}>{resolved.bs_service}</b>
              </p>
              {primaryModelDebugLine || shadowModelDebugLine ? (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    lineHeight: 1.4,
                  }}
                >
                  {primaryModelDebugLine}
                  {primaryModelDebugLine && shadowModelDebugLine ? " | " : ""}
                  {shadowModelDebugLine}
                </p>
              ) : null}
            </article>

            {topServiceCandidates.length > 0 ? (
              <details
                style={{
                  marginTop: 12,
                  border: "1px dashed var(--rule)",
                  borderRadius: 8,
                  padding: 12,
                  background: "#faf9f6",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                  }}
                >
                  Why this service? (advanced)
                </summary>
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
              </details>
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
                Final service for this audit
              </div>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                Edit if needed. This exact value is used for competitor query and final audit generation.
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
                      setCompetitorPreviewError(null);
                    }}
                    disabled={isPending}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "8px 12px",
                      border: "1px solid var(--rule)",
                      borderRadius: 8,
                      background: "#fff",
                      fontFamily: "inherit",
                      fontSize: 16,
                      lineHeight: 1.3,
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
                      setCompetitorPreviewError(null);
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
                      fontSize: 16,
                      lineHeight: 1.3,
                      fontFamily: "inherit",
                      fontWeight: 400,
                      color: "var(--ink)",
                      textTransform: "lowercase",
                    }}
                  />
                </div>
              </div>

              {suggestedServiceOptions.length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid var(--rule-soft)",
                    borderRadius: 8,
                    background: "#fff",
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-mute)",
                      fontWeight: 700,
                    }}
                  >
                    Suggested services
                  </div>
                  <p style={{ marginTop: 6, fontSize: 12, color: "var(--ink-soft)" }}>
                    {resolved.needs_service_selection
                      ? "Current label is too broad. Pick one specific service below."
                      : "Quick picks from BAAM and LLM signals. Click to use as final service."}
                  </p>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {(showAllSuggestions
                      ? suggestedServiceOptions
                      : suggestedServiceOptions.slice(0, 4)
                    ).map((option) => {
                      const isSelected = service.trim().toLowerCase() === option.toLowerCase();
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setService(option);
                            setServiceConfirmed(false);
                            setShowConfirmReminder(false);
                            setCompetitorPreviewError(null);
                          }}
                          disabled={isPending}
                          style={{
                            border: isSelected
                              ? "1px solid var(--sage-deep)"
                              : "1px solid var(--rule-soft)",
                            borderRadius: 999,
                            padding: "6px 12px",
                            fontFamily: "inherit",
                            fontSize: 16,
                            lineHeight: 1.3,
                            fontWeight: 400,
                            color: isSelected ? "var(--sage-deep)" : "var(--ink)",
                            background: isSelected ? "#e8f0e8" : "#fff",
                            cursor: isPending ? "default" : "pointer",
                            textTransform: "lowercase",
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {suggestedServiceOptions.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllSuggestions((prev) => !prev)}
                      disabled={isPending}
                      style={{
                        marginTop: 8,
                        border: "1px solid var(--rule-soft)",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        cursor: isPending ? "default" : "pointer",
                      }}
                    >
                      {showAllSuggestions ? "Show less" : `+ ${suggestedServiceOptions.length - 4} more`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  border: "1px solid var(--rule-soft)",
                  borderRadius: 8,
                  background: "#fff",
                  padding: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    fontWeight: 700,
                  }}
                >
                  Competitor preview (Places)
                </div>
                <p style={{ marginTop: 6, fontSize: 12, color: "var(--ink-soft)" }}>
                  Change service, then generate a fast competitor set preview before final
                  audit generation.
                </p>

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleGenerateCompetitors}
                    disabled={isPending || isPreviewPending || !service.trim()}
                    style={{
                      border: "1px solid var(--ink)",
                      borderRadius: 999,
                      background: "var(--ink)",
                      color: "var(--cream-light)",
                      padding: "7px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor:
                        isPending || isPreviewPending || !service.trim()
                          ? "default"
                          : "pointer",
                    }}
                  >
                    {isPreviewPending
                      ? "Generating competitors…"
                      : competitorPreview
                        ? "Regenerate competitors"
                        : "Generate competitors"}
                  </button>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--ink-soft)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={fastCompetitorMode}
                      onChange={(event) => setFastCompetitorMode(event.target.checked)}
                      disabled={isPending || isPreviewPending}
                    />
                    Fast mode (quick preview, background fill)
                  </label>

                  {competitorPreview ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: previewIsStale ? "var(--amber-deep)" : "var(--ink-soft)",
                      }}
                    >
                      {previewIsStale
                        ? "Preview is stale — service changed. Regenerate to refresh."
                        : competitorPreview.status === "hydrating"
                          ? `Hydrating ${competitorPreview.hydrated_competitors ?? 0}/${competitorPreview.total_competitors ?? competitorPreview.competitors.length} competitors…`
                          : competitorPreview.status === "failed"
                            ? "Hydration incomplete. Regenerate to retry."
                        : previewGeneratedLabel
                          ? `Generated at ${previewGeneratedLabel}`
                          : "Preview ready"}
                    </span>
                  ) : null}
                </div>
                {competitorPreview && !previewIsStale ? (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        border: "1px solid var(--rule-soft)",
                        borderRadius: 999,
                        padding: "3px 9px",
                        fontSize: 11,
                        color: "var(--ink-soft)",
                        background: "#fff",
                      }}
                    >
                      Status:{" "}
                      <strong style={{ color: "var(--ink)" }}>
                        {competitorPreview.status ?? "ready"}
                      </strong>
                    </span>
                    {hydrationGuardrail?.service_switch_overlap_count != null ? (
                      <span
                        style={{
                          border: "1px solid var(--rule-soft)",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontSize: 11,
                          color: "var(--ink-soft)",
                          background: "#fff",
                        }}
                      >
                        Overlap vs previous service:{" "}
                        <strong style={{ color: "var(--ink)" }}>
                          {hydrationGuardrail.service_switch_overlap_count}
                        </strong>
                      </span>
                    ) : null}
                    {hydrationGuardrail?.low_overlap_prewarm_triggered ? (
                      <span
                        style={{
                          border: "1px solid #9bb5d6",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontSize: 11,
                          color: "#2b5d95",
                          background: "#edf4ff",
                        }}
                      >
                        Low-overlap prewarm started
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {competitorPreviewError ? (
                  <div
                    style={{
                      marginTop: 9,
                      border: "1px solid rgba(164, 69, 42, 0.3)",
                      background: "rgba(164, 69, 42, 0.08)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#842F1B",
                    }}
                  >
                    {competitorPreviewError}
                  </div>
                ) : null}
                {isHydrationPolling && competitorPreview?.status === "hydrating" ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--ink-soft)",
                    }}
                  >
                    Filling remaining competitors in background. You can keep reviewing while this runs.
                  </div>
                ) : null}
                {competitorPreview?.status === "hydrating" &&
                hydrationGuardrail &&
                hydrationGuardrail.warning_level !== "none" ? (
                  <div
                    style={{
                      marginTop: 8,
                      border:
                        hydrationGuardrail.warning_level === "critical"
                          ? "1px solid rgba(164, 69, 42, 0.35)"
                          : "1px solid #e1c89f",
                      background:
                        hydrationGuardrail.warning_level === "critical"
                          ? "rgba(164, 69, 42, 0.08)"
                          : "#fbf0df",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      lineHeight: 1.4,
                      color:
                        hydrationGuardrail.warning_level === "critical"
                          ? "#842F1B"
                          : "var(--amber-deep)",
                    }}
                  >
                    Estimated time-to-ready:{" "}
                    <strong style={{ color: "var(--ink)" }}>
                      {formatDurationMs(
                        hydrationGuardrail.estimated_ready_total_ms,
                      )}
                    </strong>
                    {" · "}remaining{" "}
                    <strong style={{ color: "var(--ink)" }}>
                      {hydrationGuardrail.pending_competitors}
                    </strong>{" "}
                    competitors
                    {hydrationGuardrail.low_overlap_service_switch
                      ? " · low-overlap service switch detected"
                      : ""}
                    {hydrationGuardrail.warning_level === "critical"
                      ? " · This run may take longer than usual."
                      : " · This run may take around a minute."}
                  </div>
                ) : null}

                {competitorPreview ? (
                  <div
                    style={{
                      marginTop: 10,
                      border: "1px solid var(--rule-soft)",
                      borderRadius: 8,
                      background: "var(--cream-light)",
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                      <strong style={{ color: "var(--ink)" }}>Primary query:</strong>{" "}
                      {competitorPreview.search_metadata.primary_keyword}
                      {" · "}
                      <strong style={{ color: "var(--ink)" }}>Variants:</strong>{" "}
                      {(competitorPreview.search_metadata.keyword_variants ?? []).length}
                      {" · "}
                      <strong style={{ color: "var(--ink)" }}>Found:</strong>{" "}
                      {competitorPreview.search_metadata.total_candidates_found}
                      {" · "}
                      <strong style={{ color: "var(--ink)" }}>Returned:</strong>{" "}
                      {competitorPreview.competitors.length}
                      {competitorPreview.search_metadata.fallback_reason ? (
                        <>
                          {" · "}
                          <strong style={{ color: "var(--ink)" }}>Fallback:</strong>{" "}
                          {competitorPreview.search_metadata.fallback_reason}
                        </>
                      ) : null}
                    </div>
                    {competitorPreview.duration_ms != null ||
                    competitorPreview.cache_stats ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "var(--ink-soft)",
                          lineHeight: 1.35,
                        }}
                      >
                        {competitorPreview.duration_ms != null ? (
                          <>
                            <strong style={{ color: "var(--ink)" }}>Generation time:</strong>{" "}
                            {(competitorPreview.duration_ms / 1000).toFixed(1)}s
                          </>
                        ) : null}
                        {competitorPreview.cache_stats ? (
                          <>
                            {competitorPreview.duration_ms != null ? " · " : null}
                            <strong style={{ color: "var(--ink)" }}>Cache:</strong>{" "}
                            {competitorPreview.cache_stats.cache_hits}/
                            {competitorPreview.cache_stats.total} hits (
                            {competitorPreview.cache_stats.cache_hit_ratio_pct}%)
                            {competitorPreview.cache_stats.degraded_results > 0
                              ? ` · degraded ${competitorPreview.cache_stats.degraded_results}`
                              : ""}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {(
                      competitorPreview.search_metadata.fallback_keyword_variants ??
                      []
                    ).length > 0 ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "var(--ink-soft)",
                          lineHeight: 1.35,
                        }}
                      >
                        <strong style={{ color: "var(--ink)" }}>Backfill keywords:</strong>{" "}
                        {(competitorPreview.search_metadata.fallback_keyword_variants ?? []).join(
                          " · ",
                        )}
                      </div>
                    ) : null}

                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        Selected for final report:{" "}
                        <strong style={{ color: "var(--ink)" }}>
                          {selectedPreviewCount}/{selectablePreviewPlaceIds.length}
                        </strong>
                        {previewIsStale ? (
                          <span style={{ marginLeft: 8, color: "var(--amber-deep)" }}>
                            (stale preview: regenerate before selection applies)
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPreviewCompetitorPlaceIds(selectablePreviewPlaceIds)
                          }
                          disabled={selectablePreviewPlaceIds.length === 0}
                          style={{
                            border: "1px solid var(--rule)",
                            background: "#fff",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            color: "var(--ink-soft)",
                            cursor:
                              selectablePreviewPlaceIds.length === 0 ? "default" : "pointer",
                          }}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewCompetitorPlaceIds([])}
                          disabled={selectedPreviewCount === 0}
                          style={{
                            border: "1px solid var(--rule)",
                            background: "#fff",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            color: "var(--ink-soft)",
                            cursor: selectedPreviewCount === 0 ? "default" : "pointer",
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
                      {competitorPreview.competitors.map((item) => (
                        <div
                          key={item.place_id ?? `${item.rank}-${item.name}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "26px 40px 1fr auto",
                            gap: 10,
                            alignItems: "center",
                            border: "1px solid var(--rule-soft)",
                            borderRadius: 8,
                            background: "#fff",
                            padding: "7px 9px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <input
                              type="checkbox"
                              checked={
                                item.place_id
                                  ? selectedPreviewPlaceIdSet.has(item.place_id)
                                  : false
                              }
                              disabled={!item.place_id}
                              onChange={(e) => {
                                const placeId = item.place_id;
                                if (!placeId) return;
                                setSelectedPreviewCompetitorPlaceIds((prev) => {
                                  if (e.target.checked) {
                                    return prev.includes(placeId)
                                      ? prev
                                      : [...prev, placeId];
                                  }
                                  return prev.filter((id) => id !== placeId);
                                });
                              }}
                              style={{ cursor: item.place_id ? "pointer" : "default" }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--ink-soft)",
                              textAlign: "center",
                            }}
                          >
                            #{item.rank}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                              {item.name}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11, color: "var(--ink-soft)" }}>
                              {item.primary_category || "Category unknown"}
                              {item.city ? ` · ${item.city}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 12, color: "var(--ink-soft)" }}>
                            <div>
                              ★ {item.rating?.toFixed(1) ?? "—"} · {item.total_count} reviews
                            </div>
                            <div style={{ marginTop: 2 }}>
                              {item.distance_miles != null
                                ? `${item.distance_miles.toFixed(1)} mi`
                                : "distance —"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
              <span>Confirm and generate</span>
            </h4>

            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--rule-soft)",
                background: "var(--cream-light)",
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
                  I confirm the selected <strong>Industry</strong>,{" "}
                  <strong>Final Service</strong>, and <strong>Competitors</strong>{" "}
                  are correct for this audit.
                  <span style={{ display: "block", marginTop: 6, color: "var(--ink-soft)" }}>
                    Final service: <b>{finalService}</b>. Competitors selected:{" "}
                    <b>{selectedPreviewCount}</b>. Review carefully before generating.
                  </span>
                </span>
              </label>
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

          <div className="found-action-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="found-action-generate"
              disabled={
                isPending ||
                !service.trim() ||
                competitorPreview?.status === "hydrating"
              }
            >
              {isPending
                ? "Starting audit…"
                : competitorPreview?.status === "hydrating"
                  ? "Competitors still loading…"
                  : "Generate audit →"}
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
                Verify Industry, Final Service, and selected Competitors, then check
                the confirmation box to continue.
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

function isBroadServiceInput(value: string, vertical?: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  return isBroadServiceTerm(normalized, { vertical });
}

function normalizePreviewService(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ");
}

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}
