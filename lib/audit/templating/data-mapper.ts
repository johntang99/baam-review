import type { AuditCompetitorsData } from "../competitors/types";
import { resolveServiceKeyword } from "../competitors/keyword-resolver";
import type { AuditGoogleData, VerticalKey } from "../google/types";
import type { AuditProjection } from "../projection/types";
import { computeAuditScore } from "../scoring";
import type { AuditScore, ScoreComponent } from "../scoring/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import { canonicalizeService } from "../service-taxonomy";
import { renderProjectionSvg } from "./chart-svg";
import { LABELS, STRINGS } from "./labels";
import type {
  ActionItemVM,
  AppendixValueRowVM,
  AppendixVelocityRowVM,
  AuditLanguage,
  AuditViewModel,
  CompetitorRowVM,
  PlatformRowVM,
  RenderAuditInput,
  ScaleTickVM,
  ServiceOpportunityVM,
  SubscoreRowVM,
  TranslatedStrings,
} from "./types";

export function buildAuditViewModel(input: RenderAuditInput): AuditViewModel {
  const { google, competitors, score, projection, benchmarks, tier } = input;
  const language: AuditLanguage = input.language ?? "en";
  const t = LABELS[language];
  const preparedAt = input.prepared_at ?? new Date();
  const auditId =
    input.audit_id ?? generateAuditId(google.business.place_id, preparedAt);
  const planSummary = buildActionPlanSummary(google, benchmarks);
  const competitorRows = buildCompetitorRows(
    google,
    competitors,
    score,
    benchmarks,
    language,
  );
  const yourRankIndex = competitorRows.findIndex((row) => row.is_you);
  const yourRank = yourRankIndex >= 0 ? yourRankIndex + 1 : null;
  const rankingGainDisplay = formatRankingGain(
    projection.ranking_estimate.do_nothing_six_month_drop,
  );
  const forecastOutcome = buildForecastOutcomeCopy({
    language,
    currentGrade: score.grade,
    projectedGrade: projection.twelve_month.with_baam_grade,
    rankingGainDisplay,
  });

  return {
    language,
    audit_id: auditId,
    audit_date_display: formatDate(preparedAt, language),

    business_name: pickPrimaryName(google.business.name, language),
    business_name_secondary: pickSecondaryName(google.business, language),
    business_address_line_1: google.business.street,
    business_address_line_2:
      language === "zh"
        ? formatZhAddressLine2(google)
        : `${google.business.city} · ${google.business.state} ${google.business.zip}`.trim(),
    business_website_line: displayWebsite(google.business.website),
    vertical_display_name: t.verticals[google.vertical.inferred_vertical] ?? t.verticals.general_smb,
    vertical_subtype: formatVerticalSubtype(google, language),
    cover_service_display: formatCoverServiceDisplay(google, competitors, score, language),

    doc_header_subtitle_left: t.doc_header_subtitle,

    page_count_display: tier === "paid" ? "07" : "03",
    is_paid: tier === "paid",

    snapshot_google: buildGooglePlatformRow(google, language),
    snapshot_yelp: input.platforms?.yelp
      ? buildYelpPlatformRow(input.platforms.yelp, language)
      : null,
    insight_callout_html: buildInsightCallout(google, score, language),

    score_total: score.total,
    score_grade: score.grade,
    score_grade_diagnosis: t.grade_diagnoses[score.grade],
    subscore_rows: buildSubscoreRows(score, benchmarks.weights, language),

    projection_svg: renderProjectionSvg(projection, score.total),
    // §04 forecast cells reframed as the upside of working with BAAM Review
    // (12-month with-baam trajectory), not the do-nothing decline.
    projection_six_month_score: projection.twelve_month.with_baam_score,
    projection_six_month_grade: projection.twelve_month.with_baam_grade,
    projection_six_month_drop_display: `${score.total} → ${projection.twelve_month.with_baam_score}`,
    projection_ranking_drop_display: rankingGainDisplay,
    projection_revenue_loss_display: `$${projection.revenue_impact.six_month_loss_usd.toLocaleString()}`,
    projection_floor_blurb: buildProjectionFloorBlurb(score, projection, language),
    forecast_google_ranking_display: forecastOutcome.google_ranking_display,
    forecast_google_ranking_desc: forecastOutcome.google_ranking_desc,
    forecast_ai_visibility_display: forecastOutcome.ai_visibility_display,
    forecast_ai_visibility_desc: forecastOutcome.ai_visibility_desc,
    forecast_referral_retention_display: forecastOutcome.referral_retention_display,
    forecast_referral_retention_desc: forecastOutcome.referral_retention_desc,
    forecast_revenue_display: forecastOutcome.revenue_display,
    forecast_revenue_desc: forecastOutcome.revenue_desc,

    per_review_value_median_display: `$${benchmarks.per_review_value.median_usd.toLocaleString()}`,
    per_review_value_range_display: `$${benchmarks.per_review_value.range_low_usd.toLocaleString()} — $${benchmarks.per_review_value.range_high_usd.toLocaleString()}`,
    velocity_band_silent: `${t.gauge.silent} · 0–${benchmarks.healthy_velocity.minimum_per_month - 1 || 1}`,
    velocity_band_min: `${t.gauge.min} · ${benchmarks.healthy_velocity.minimum_per_month}–${benchmarks.healthy_velocity.optimal_low_per_month - 1}`,
    velocity_band_optimal: `${t.gauge.optimal} · ${benchmarks.healthy_velocity.optimal_low_per_month}–${benchmarks.healthy_velocity.optimal_high_per_month}`,
    velocity_band_aggressive: `${benchmarks.healthy_velocity.aggressive_per_month}+`,
    velocity_pointer_pct: computeVelocityPointerPct(
      google.reviews_aggregate.velocity_30d_per_month,
      benchmarks,
    ),
    velocity_pointer_label: buildVelocityPointerLabel(
      google.reviews_aggregate.velocity_30d_per_month,
      language,
    ),
    money_on_table_html: buildMoneyOnTableHtml(google, competitors, benchmarks, language),

    competitor_rows: competitorRows,
    competitor_diagnosis_html: buildCompetitorDiagnosis(google, competitors, benchmarks, language),
    competitor_closing_line: buildCompetitorClosingLine(google, competitors, language),

    action_items: buildActionItems(google, score, competitors, benchmarks, language),

    service_opportunity: buildServiceOpportunity(score.total, score.grade, auditId),

    appendix_value_rows: buildAppendixValueRows(google.vertical.inferred_vertical, language),
    appendix_velocity_rows: buildAppendixVelocityRows(google.vertical.inferred_vertical, language),

    t: buildTranslatedStrings(language, {
      page_count_display: tier === "paid" ? "07" : "03",
      score_grade: score.grade,
      vertical_display_name: t.verticals[google.vertical.inferred_vertical] ?? t.verticals.general_smb,
      per_review_value_median_display: `$${benchmarks.per_review_value.median_usd.toLocaleString()}`,
      per_review_value_range_display: `$${benchmarks.per_review_value.range_low_usd.toLocaleString()} — $${benchmarks.per_review_value.range_high_usd.toLocaleString()}`,
      summary_new_reviews: `+${planSummary.newReviews.toLocaleString()}`,
      summary_new_customers: `+${planSummary.newCustomers.toLocaleString()}`,
      summary_per_review_value: `$${planSummary.perReviewValue.toLocaleString()}`,
      summary_review_asset: `$${planSummary.reviewAssetValue.toLocaleString()}`,
      service_opportunity: buildServiceOpportunity(score.total, score.grade, auditId),
      business_name_display: pickPrimaryName(google.business.name, language),
      score_total: score.total,
      competitor_count: competitors.competitors.length,
      your_rank: yourRank,
      forecast_grade: projection.twelve_month.with_baam_grade,
      forecast_score: projection.twelve_month.with_baam_score,
    }),
  };
}

function buildTranslatedStrings(
  language: AuditLanguage,
  ctx: {
    page_count_display: string;
    score_grade: string;
    vertical_display_name: string;
    per_review_value_median_display: string;
    per_review_value_range_display: string;
    summary_new_reviews: string;
    summary_new_customers: string;
    summary_per_review_value: string;
    summary_review_asset: string;
    service_opportunity: ServiceOpportunityVM;
    business_name_display: string;
    score_total: number;
    competitor_count: number;
    your_rank: number | null;
    forecast_grade: "A" | "B" | "C" | "D" | "F";
    forecast_score: number;
  },
): TranslatedStrings {
  const s = STRINGS[language];
  const t = LABELS[language];
  const isZh = language === "zh";

  return {
    cover_eyebrow: s.cover_eyebrow(ctx.page_count_display),
    cover_title_html: s.cover_title_html,
    cover_subtitle: s.cover_subtitle,
    cover_meta_labels: s.cover_meta_labels,
    cover_meta_subtitle: s.cover_meta_subtitle,
    cover_toc: buildCoverTocRows(language, s, ctx),
    hook_quote_html: s.hook_quote_html,
    section_titles: s.section_titles as TranslatedStrings["section_titles"],
    section_headlines: s.section_headlines as TranslatedStrings["section_headlines"],
    section_decks: s.section_decks as TranslatedStrings["section_decks"],
    snapshot_table_headers: s.snapshot_table_headers,
    paid_only_row: s.paid_only_row,
    methodology_eyebrow: s.methodology_eyebrow,
    methodology_text_html: s.methodology_text_html,
    velocity_drag_line_html: s.velocity_drag_line_html,
    forecast_eyebrow: s.forecast_eyebrow,
    projection_title_html: s.projection_title_html,
    projection_deck: s.projection_deck,
    projection_legend_lines: s.projection_legend_lines,
    projection_impact_labels: s.projection_impact_labels,
    projection_results_items: s.projection_results_items,
    ranking_drop_sub: isZh
      ? "預估本地搜尋包排名下滑 · 競爭對手持續複利擴大差距"
      : "Estimated Local Pack drop · competitors compounding the gap",
    revenue_loss_sub: isZh
      ? "6 個月機會成本 · 行業每則評論價值 × 錯失的評論數"
      : "6-month opportunity cost · vertical per-review value × missed reviews",
    grade_scale_eyebrow: s.grade_scale_eyebrow,
    grade_scale_headline_html: s.grade_scale_headline_html(ctx.score_grade),
    grade_scale_headers: s.grade_scale_headers,
    grade_scale_table: s.grade_scale_table,
    you_tag: t.you_tag,
    page_label_1: s.page_label(1, ctx.page_count_display),
    page_label_2: s.page_label(2, ctx.page_count_display),
    page_label_3: s.page_label(3, ctx.page_count_display),
    page_label_4: s.page_label(4, ctx.page_count_display),
    page_label_5: s.page_label(5, ctx.page_count_display),
    page_label_6: s.page_label(6, ctx.page_count_display),
    page_label_7: s.page_label(7, ctx.page_count_display),
    upgrade_cta_section_num: s.upgrade_cta_section_num,
    upgrade_cta_title: s.upgrade_cta_title,
    upgrade_cta_headline_html: s.upgrade_cta_headline_html,
    upgrade_cta_items: s.upgrade_cta_items,
    upgrade_cta_closing: s.upgrade_cta_closing,
    section_4_headline_html: s.section_4_headline_html,
    section_4_deck: s.section_4_deck,
    benchmark_panel_a_eyebrow: s.benchmark_panel_a_eyebrow,
    benchmark_panel_a_title: s.benchmark_panel_a_title_html(ctx.vertical_display_name),
    benchmark_panel_a_detail_html: s.benchmark_panel_a_detail_html(
      ctx.per_review_value_median_display,
      ctx.per_review_value_range_display,
    ),
    benchmark_panel_a_methodology: s.benchmark_panel_a_methodology,
    benchmark_panel_a_range_prefix: isZh ? "範圍：" : "range: ",
    benchmark_panel_a_horizon_suffix: isZh ? "24 個月時程" : "24-month horizon",
    benchmark_panel_b_eyebrow: s.benchmark_panel_b_eyebrow,
    benchmark_panel_b_title_html: s.benchmark_panel_b_title_html,
    benchmark_panel_b_detail_html: s.benchmark_panel_b_detail_html,
    money_on_table_eyebrow: s.money_on_table_eyebrow,
    section_5_headline_html: s.section_5_headline_html,
    section_5_deck: s.section_5_deck,
    competitor_table_headers: s.competitor_table_headers,
    section_6_headline_html: s.section_6_headline_html,
    section_6_deck: s.section_6_deck,
    summary_block_html: s.summary_block_html({
      newReviews: ctx.summary_new_reviews,
      newCustomers: ctx.summary_new_customers,
      perReviewValue: ctx.summary_per_review_value,
      reviewAsset: ctx.summary_review_asset,
    }),
    cta_eyebrow: s.cta_eyebrow,
    cta_headline_html: s.cta_headline_html,
    cta_self: s.cta_self,
    cta_full: s.cta_full,
    cta_promise_html: s.cta_promise_html,
    cta_action_self_label: s.cta_action_self_label,
    cta_action_full_label: s.cta_action_full_label,
    cta_action_compare_label: s.cta_action_compare_label,
    so_big_title: s.so_big_title,
    so_eyebrow: s.so_eyebrow,
    so_headline_html: s.so_headline_html(
      ctx.service_opportunity.starting_score,
      ctx.service_opportunity.d180_grade,
      ctx.service_opportunity.m12_grade,
    ),
    so_deck: s.so_deck,
    so_stat_label_90d: s.so_stat_label_90d,
    so_stat_label_180d: s.so_stat_label_180d,
    so_stat_label_12mo: s.so_stat_label_12mo,
    so_stat_sub_90d: isZh
      ? ctx.service_opportunity.d90_grade_label_zh
      : ctx.service_opportunity.d90_grade_label_en,
    so_stat_sub_180d: isZh
      ? ctx.service_opportunity.d180_grade_label_zh
      : ctx.service_opportunity.d180_grade_label_en,
    so_stat_sub_12mo: isZh
      ? ctx.service_opportunity.m12_grade_label_zh
      : ctx.service_opportunity.m12_grade_label_en,
    so_tier_self_name_html: s.so_tier_self_name_html,
    so_tier_self_price: s.so_tier_self_price,
    so_tier_self_projection_html: s.so_tier_self_projection_html(
      ctx.business_name_display,
      ctx.service_opportunity.self_d90_display,
    ),
    so_tier_self_cta: s.so_tier_self_cta,
    so_tier_full_name_html: s.so_tier_full_name_html,
    so_tier_full_price: s.so_tier_full_price,
    so_tier_full_projection_html: s.so_tier_full_projection_html(
      ctx.business_name_display,
      ctx.service_opportunity.full_d90_display,
    ),
    so_tier_full_cta: s.so_tier_full_cta,
    so_tier_full_recommended: s.so_tier_full_recommended,
    so_compare_link: s.so_compare_link,
    so_trust_line: s.so_trust_line,
    inline_service_preview_html: s.inline_service_preview_html,
    inline_service_preview_link: s.inline_service_preview_link,
    appendix_section_title: s.appendix_section_title,
    appendix_section_headline_html: s.appendix_section_headline_html,
    appendix_section_deck_html: s.appendix_section_deck_html,
    appendix_a1_eyebrow: s.appendix_a1_eyebrow,
    appendix_a1_title: s.appendix_a1_title,
    appendix_a1_deck: s.appendix_a1_deck,
    appendix_a1_headers: s.appendix_a1_headers,
    appendix_a2_eyebrow: s.appendix_a2_eyebrow,
    appendix_a2_title: s.appendix_a2_title,
    appendix_a2_deck: s.appendix_a2_deck,
    appendix_a2_headers: s.appendix_a2_headers,
    appendix_source_html: s.appendix_source_html,
    appendix_citations_prefix: isZh ? "完整引用於" : "Full citations at",
    appendix_closing_quote_html: s.appendix_closing_quote_html,
    end_label: s.end_label,
    brand_label: isZh ? "評論審計" : "Review Audit",
    vol_label: isZh ? "第 I 卷 · 第 001 號" : "Vol. I · No. 001",
    date_prefix: isZh ? "" : "Prepared ",
    grade_label_prefix: isZh ? "等級 · " : "Grade · Tier ",
    score_breakdown_label: isZh ? "分數細項 · 為何是這個數字" : "Score breakdown · Why your number is what it is",
    ranking_position_sub: isZh
      ? "預估本地搜尋包排名下滑 · 競爭對手持續複利擴大差距"
      : "Estimated Local Pack drop · competitors compounding the gap",
    revenue_cost_sub: isZh
      ? "6 個月機會成本 · 行業每則評論價值 × 錯失的評論數"
      : "6-month opportunity cost · vertical per-review value × missed reviews",
    range_prefix: isZh ? "範圍：" : "range: ",
  };
}

function buildCoverTocRows(
  language: AuditLanguage,
  s: (typeof STRINGS)[AuditLanguage],
  ctx: {
    score_total: number;
    score_grade: string;
    competitor_count: number;
    your_rank: number | null;
    forecast_grade: "A" | "B" | "C" | "D" | "F";
    forecast_score: number;
  },
): Array<{ num: string; title: string; sub: string }> {
  const isZh = language === "zh";
  const base = s.cover_toc;
  const snapshotSub = isZh
    ? `分數 ${ctx.score_total} / 100 · ${ctx.score_grade} 級 · ${gradeResultTagZh(ctx.score_grade)}`
    : `Score ${ctx.score_total} / 100 · Grade ${ctx.score_grade} · ${gradeResultTagEn(ctx.score_grade)}`;

  const competitorSub =
    ctx.competitor_count > 0 && ctx.your_rank
      ? isZh
        ? `競爭差距 · ${ctx.competitor_count} 位對手 · 您 #${ctx.your_rank}`
        : `Gap · ${ctx.competitor_count} competitors · You #${ctx.your_rank}`
      : isZh
        ? "尚無可比競爭對手"
        : "No comparable competitors yet";

  const serviceSub = isZh ? "升級窗口 · 90–120 天" : "Upgrade window · 90–120 days";
  const forecastSub = isZh
    ? `目標結果 · ${ctx.forecast_grade} 級 · ${ctx.forecast_score} 分 · 營收成長`
    : `Target · Grade ${ctx.forecast_grade} · Score ${ctx.forecast_score} · Revenue increase`;
  const actionSub = isZh ? "執行計劃 · 3 項優先行動" : "Execution · 3 owner-ready moves";

  return [
    {
      num: "02",
      title: base[0]?.title ?? (isZh ? "您目前的狀況概覽" : "Your current snapshot"),
      sub: snapshotSub,
    },
    {
      num: "03",
      title: base[1]?.title ?? (isZh ? "競爭對手比較" : "Competitor comparison"),
      sub: competitorSub,
    },
    {
      num: "04",
      title: base[2]?.title ?? (isZh ? "服務機會" : "Service opportunity"),
      sub: serviceSub,
    },
    {
      num: "05",
      title: base[3]?.title ?? (isZh ? "12 個月預測" : "The 12-month forecast"),
      sub: forecastSub,
    },
    {
      num: "06",
      title: base[4]?.title ?? (isZh ? "您的行動計劃" : "Your action plan"),
      sub: actionSub,
    },
  ];
}

function gradeResultTagEn(grade: string): string {
  if (grade === "A") return "Leading";
  if (grade === "B") return "Strong";
  if (grade === "C") return "Recoverable";
  if (grade === "D") return "At risk";
  return "High risk";
}

function gradeResultTagZh(grade: string): string {
  if (grade === "A") return "領先";
  if (grade === "B") return "穩健";
  if (grade === "C") return "可恢復";
  if (grade === "D") return "風險偏高";
  return "高風險";
}

function generateAuditId(placeId: string, date: Date): string {
  const yymm = date.toISOString().slice(2, 7).replace("-", "");
  const tail = placeId.slice(-4).toUpperCase();
  return `BR-${yymm}-${tail}`;
}

function formatDate(d: Date, language: AuditLanguage): string {
  if (language === "zh") {
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pickPrimaryName(fullName: string, language: AuditLanguage): string {
  const ascii = fullName.replace(/[^\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  const cjk = fullName.replace(/[\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  if (language === "zh") return cjk || ascii || fullName.trim();
  return ascii || cjk || fullName.trim();
}

function pickSecondaryName(
  business: AuditGoogleData["business"],
  language: AuditLanguage,
): string {
  const ascii = business.name.replace(/[^\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  const cjk = business.name.replace(/[\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  // A secondary name only exists when the listing has BOTH scripts
  // (e.g. "德誉堂 Deyu TCM"). A single-script name has no second line.
  if (!ascii || !cjk) return "";
  if (language === "zh") return ascii;
  return cjk;
}

/** Compact street + city used inline under the business name in the
 *  competitor table. Skips state/ZIP/country since every row is in the
 *  same metro and the redundancy would push the column too wide. */
function shortAddress(business: AuditGoogleData["business"]): string {
  const street = business.street?.trim();
  if (street && business.city) return `${street}, ${business.city}`;
  if (street) return street;
  if (business.address_lines?.[0]) return business.address_lines[0];
  return business.formatted_address ?? "";
}

function formatZhAddressLine2(google: AuditGoogleData): string {
  const stateZh = google.business.state === "NY" ? "紐約州" : google.business.state;
  return `${stateZh}${google.business.city} · ${google.business.zip}`.trim();
}

function formatVerticalSubtype(
  google: AuditGoogleData,
  language: AuditLanguage,
): string {
  const cat = google.vertical.primary_category.replace(/_/g, " ");
  if (language === "zh") {
    const biZh = google.language.is_bilingual ? " · 雙語服務" : "";
    return `${capitalize(cat)}${biZh}`;
  }
  const bi = google.language.is_bilingual ? " · Bilingual" : "";
  return `${capitalize(cat)}${bi}`;
}

function displayWebsite(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  try {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }
}

function formatCoverServiceDisplay(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  score: AuditScore,
  language: AuditLanguage,
): string {
  const resolvedService = resolveConfirmedService({
    google,
    competitors,
    score,
  });
  const canonicalService = canonicalizeService(resolvedService);
  const service = refineBroadEducationService({
    rawService: resolvedService,
    canonicalService,
    google,
  });
  if (language === "zh") {
    return translateServiceZh(canonicalService || canonicalizeService(service) || service);
  }
  return capitalize(service);
}

function resolveConfirmedService(args: {
  google: AuditGoogleData;
  competitors: AuditCompetitorsData;
  score: AuditScore;
}) {
  const fromScoreRaw = String(args.score.service_context?.confirmed_service ?? "").trim();
  if (fromScoreRaw) return fromScoreRaw;

  const fromScoreCanonical = canonicalizeService(
    args.score.service_context?.confirmed_service_canonical,
  );
  if (fromScoreCanonical) return fromScoreCanonical;

  const fromKeyword = parseServiceFromPrimaryKeyword(
    args.competitors.search_metadata.primary_keyword,
    args.google.business.city,
  );
  if (fromKeyword) return fromKeyword;

  return resolveServiceKeyword(args.google);
}

function parseServiceFromPrimaryKeyword(keyword: string | null | undefined, city: string | null | undefined) {
  const raw = String(keyword ?? "").trim();
  if (!raw) return "";
  const cityRaw = String(city ?? "").trim();
  if (!cityRaw) return raw;

  const escapedCity = escapeRegex(cityRaw);
  const trimmed = raw.replace(new RegExp(`\\s+${escapedCity}\\s*$`, "i"), "").trim();
  return trimmed || raw;
}

function refineBroadEducationService(args: {
  rawService: string;
  canonicalService: string;
  google: AuditGoogleData;
}): string {
  const raw = String(args.rawService ?? "").trim();
  const normalized = args.canonicalService || canonicalizeService(raw);
  if (normalized && !["school", "academy", "education", "training center"].includes(normalized)) {
    return raw || normalized;
  }
  const text = [
    args.google.business.name,
    args.google.business.description ?? "",
    args.google.vertical.primary_category_display ?? "",
    args.google.vertical.primary_category ?? "",
    (args.google.vertical.google_categories ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  if (/\b(language school|esl|english school)\b/.test(text)) return "language school";
  if (/\b(vocational|trade school|career training)\b/.test(text)) {
    return "vocational training center";
  }
  if (/\b(school|academy|after school|tutor|tutoring|learning center|test prep)\b/.test(text)) {
    return "tutoring service";
  }
  return normalized || raw || "local business";
}

function translateServiceZh(service: string): string {
  const map: Record<string, string> = {
    "tutoring service": "課後輔導",
    "language school": "語言學校",
    "vocational training center": "職業培訓中心",
  };
  return map[service] ?? capitalize(service);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGooglePlatformRow(
  google: AuditGoogleData,
  language: AuditLanguage,
): PlatformRowVM {
  const t = LABELS[language];
  const rating = google.reviews_aggregate.rating;
  const total = google.reviews_aggregate.total_count;
  const daysAgo = google.reviews_aggregate.last_review_days_ago;
  const health = google.profile_health;

  let healthLabel = t.health.verified;
  let healthClass: "good" | "warn" | "missing" = "good";
  if (!health.is_claimed) {
    healthLabel = t.health.not_claimed;
    healthClass = "missing";
  } else if (!health.has_website || health.photos_count < 5) {
    healthLabel = `${health.profile_completeness}%`;
    healthClass = "warn";
  }

  return {
    icon: "G",
    name: t.platforms.google_name,
    meta_sub: t.platforms.google_meta,
    rating_stars_html: renderStarsHtml(rating),
    rating_value: rating.toFixed(1),
    review_count: total,
    last_review_label: formatLastReview(daysAgo, language),
    last_review_is_stale: daysAgo == null || daysAgo > 60,
    health_label: healthLabel,
    health_class: healthClass,
  };
}

function buildYelpPlatformRow(
  yelp: import("../platforms/types").AuditPlatformData,
  language: AuditLanguage,
): PlatformRowVM {
  const rating = yelp.rating ?? 0;
  const daysAgo = yelp.last_review_days_ago;
  const healthClass: "good" | "warn" | "missing" = yelp.profile_health.is_claimed
    ? "good"
    : "missing";
  const healthLabel = yelp.profile_health.is_claimed
    ? language === "zh"
      ? "已認領"
      : "Listed"
    : language === "zh"
      ? "未認領"
      : "Not claimed";

  return {
    icon: "Y",
    name: "Yelp",
    meta_sub: language === "zh" ? "次要 · 紐約市常用" : "Secondary · heavy use in NYC",
    rating_stars_html: rating > 0 ? renderStarsHtml(rating) : "<span class=\"stars\" style=\"opacity:.4;\">☆☆☆☆☆</span>",
    rating_value: rating > 0 ? rating.toFixed(1) : "—",
    review_count: yelp.total_count,
    last_review_label: daysAgo != null ? formatLastReview(daysAgo, language) : language === "zh" ? "從未" : "never",
    last_review_is_stale: daysAgo == null || daysAgo > 60,
    health_label: healthLabel,
    health_class: healthClass,
  };
}

function renderStarsHtml(rating: number): string {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const halfStar = hasHalf ? "★" : "";
  const emptyCount = Math.max(0, 5 - full - (hasHalf ? 1 : 0));
  const filled = "★".repeat(full);
  const empty = "☆".repeat(emptyCount);
  return `<span class="stars">${filled}</span>${halfStar}${empty}`;
}

function formatLastReview(daysAgo: number | null, language: AuditLanguage): string {
  const t = LABELS[language];
  if (daysAgo == null) return t.last_review.never;
  if (daysAgo === 0) return t.last_review.today;
  if (daysAgo === 1) return t.last_review.yesterday;
  if (daysAgo < 30) return t.last_review.days(daysAgo);
  const months = Math.round(daysAgo / 30);
  return months === 1 ? t.last_review.one_month : t.last_review.months(months);
}

function buildInsightCallout(
  google: AuditGoogleData,
  score: AuditScore,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const rating = google.reviews_aggregate.rating;
  const count = google.reviews_aggregate.total_count;
  const daysAgo = google.reviews_aggregate.last_review_days_ago;
  return t.insight_callout({
    rating,
    count,
    days_ago: daysAgo,
    weakest: score.weakest_component,
  });
}

function buildSubscoreRows(
  score: AuditScore,
  weights: VerticalBenchmarks["weights"],
  language: AuditLanguage,
): SubscoreRowVM[] {
  const t = LABELS[language];

  const weightPctMap: Record<string, number> = {
    rating_quality: weights.rating_quality * 100,
    review_volume: weights.review_volume * 100,
    velocity_30d: weights.velocity_30d * 100,
    velocity_180d: weights.velocity_180d * 100,
    velocity_365d: weights.velocity_365d * 100,
  };

  return (
    ["rating_quality", "review_volume", "velocity_30d", "velocity_180d", "velocity_365d"] as const
  )
    .filter((key) => score.components[key].weight > 0)
    .map((key) => {
      const comp = score.components[key];
      return {
        label: t.subscore_labels[key],
        raw_value_html: buildRawValueHtml(key, comp, language),
        footnote: buildSubscoreFootnote(key, comp, language),
        fill_pct: comp.raw_score,
        fill_class: comp.raw_score < 50 ? "weak" : comp.raw_score >= 80 ? "strong" : "",
        marks: comp.rubric_anchors
          .filter((a) => a.is_key || a.score === 100)
          .map((a) => ({ left_pct: a.score })),
        scale_ticks: buildScaleTicks(comp),
        score: comp.raw_score,
        weight_pct: Math.round(weightPctMap[key]),
      };
    });
}

function buildRawValueHtml(key: string, comp: ScoreComponent, language: AuditLanguage): string {
  const t = LABELS[language];
  if (key === "rating_quality") {
    return `${t.composite_prefix} <span class="mono-num">${comp.measured_value.toFixed(2)} ★</span>`;
  }
  if (key === "review_volume") {
    return `<span class="mono-num">${comp.measured_value}</span> ${t.total_reviews_suffix}`;
  }
  const suffix = key === "velocity_30d" ? "" : ` ${t.avg_suffix}`;
  return `<span class="mono-num">${comp.measured_value.toFixed(1)} / mo</span>${suffix}`;
}

function buildSubscoreFootnote(key: string, comp: ScoreComponent, language: AuditLanguage): string {
  const t = LABELS[language];
  if (comp.measured_value_calculation) return comp.measured_value_calculation;
  if (key === "rating_quality") return t.footnotes.rating;
  if (key === "review_volume") return t.footnotes.volume;
  return "";
}

function buildScaleTicks(comp: ScoreComponent): ScaleTickVM[] {
  const ticks: ScaleTickVM[] = [];
  for (const anchor of comp.rubric_anchors) {
    if (anchor === comp.rubric_anchors[0]) {
      ticks.push({ label: anchor.label, position: "anchor-left" });
    } else if (anchor === comp.rubric_anchors[comp.rubric_anchors.length - 1]) {
      ticks.push({ label: anchor.label, position: "anchor-right" });
    } else if (anchor.is_key) {
      ticks.push({ label: anchor.label, position: "key", left_pct: anchor.score });
    }
  }
  return ticks;
}

// Reframed as the climb with BAAM Review: the magnitude of the projected
// do-nothing slide becomes the positions recovered with sustained effort.
function formatRankingGain(referenceDrop: number): string {
  const abs = Math.max(1, Math.abs(referenceDrop));
  return `+${abs} to +${abs + 1}`;
}

function buildForecastOutcomeCopy(args: {
  language: AuditLanguage;
  currentGrade: "A" | "B" | "C" | "D" | "F";
  projectedGrade: "A" | "B" | "C" | "D" | "F";
  rankingGainDisplay: string;
}) {
  const isZh = args.language === "zh";
  return {
    google_ranking_display: args.rankingGainDisplay,
    google_ranking_desc: isZh
      ? "預估本地搜尋包排名提升（6 個月）"
      : "Estimated Local Pack climb in 6 months",
    ai_visibility_display: `${args.currentGrade} → ${args.projectedGrade}`,
    ai_visibility_desc: isZh
      ? "AI 可見度等級提升（回答中更常被提及）"
      : "AI visibility grade lift (more likely to be cited in answers)",
    referral_retention_display: isZh
      ? "回流與轉介紹循環"
      : "Customers return & refer",
    referral_retention_desc: isZh
      ? "願意留下評論的人，更可能再次消費，並主動推薦他人。"
      : "People who leave reviews are more likely to come back and refer others.",
    revenue_display: isZh ? "營收將持續成長" : "Revenue will increase",
    revenue_desc: isZh
      ? "當排名提升、AI 可見度增加、轉介紹與留存同步成長，營收將確定上行。"
      : "With stronger ranking, higher AI visibility, and better referral and retention, revenue is set to rise.",
  };
}

function buildProjectionFloorBlurb(
  score: AuditScore,
  projection: AuditProjection,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const endGrade = projection.twelve_month.with_baam_grade;
  if (endGrade !== score.grade) {
    return t.projection_floor.climbed(score.grade, endGrade);
  }
  // Already in the top grade with little room to climb — frame as defending
  // the lead rather than a generic "climbs steadily".
  if (score.grade === "A") return t.projection_floor.maintain(score.grade);
  return t.projection_floor.same_grade;
}

function computeVelocityPointerPct(
  velocity: number | null,
  benchmarks: VerticalBenchmarks,
): number {
  const v = Math.max(0, velocity ?? 0);
  const hv = benchmarks.healthy_velocity;

  // The gauge bands are laid out by CSS flex weights, NOT by their numeric
  // widths — so the pointer has to be placed segment-by-segment to land in
  // the right band. These weights MUST match styles.css `.velocity-band.*`:
  //   silent 1.5 · min 1.2 · optimal 1.5 · aggressive 1   (total 5.2)
  const T = 5.2;
  const segments = [
    { vFrom: 0, vTo: hv.minimum_per_month, pFrom: 0, pTo: 1.5 / T },
    { vFrom: hv.minimum_per_month, vTo: hv.optimal_low_per_month, pFrom: 1.5 / T, pTo: 2.7 / T },
    { vFrom: hv.optimal_low_per_month, vTo: hv.optimal_high_per_month, pFrom: 2.7 / T, pTo: 4.2 / T },
    // Aggressive band is open-ended; map up to 1.5× the aggressive threshold.
    { vFrom: hv.optimal_high_per_month, vTo: hv.aggressive_per_month * 1.5, pFrom: 4.2 / T, pTo: 1 },
  ];

  for (const s of segments) {
    if (v <= s.vTo) {
      const t = s.vTo === s.vFrom ? 0 : (v - s.vFrom) / (s.vTo - s.vFrom);
      const pct = (s.pFrom + t * (s.pTo - s.pFrom)) * 100;
      return Math.max(0, Math.min(100, pct));
    }
  }
  return 100;
}

function buildVelocityPointerLabel(
  velocity: number | null,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const v = velocity ?? 0;
  return t.velocity_pointer(v);
}

function buildMoneyOnTableHtml(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const compAvg = competitors.competitor_aggregate.avg_velocity_30d_per_month ?? 0;
  const youAvg = google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const gap = Math.max(0, compAvg - youAvg);
  const annualGap = gap * 12;
  const annualLoss = Math.round(annualGap * benchmarks.per_review_value.median_usd);

  return t.money_on_table({
    competitor_avg: compAvg,
    you_avg: youAvg,
    gap,
    annual_loss: annualLoss,
  });
}

function buildCompetitorRows(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  score: AuditScore,
  benchmarks: VerticalBenchmarks,
  language: AuditLanguage,
): CompetitorRowVM[] {
  const t = LABELS[language];

  const youRow: CompetitorRowVM = {
    rank: "—",
    name: pickPrimaryName(google.business.name, language),
    name_secondary: pickSecondaryName(google.business, language),
    address: shortAddress(google.business),
    is_you: true,
    score: score.total,
    rating_display: `${google.reviews_aggregate.rating.toFixed(1)} ★`,
    total_count: google.reviews_aggregate.total_count,
    last_30d: google.reviews_aggregate.reviews_30d ?? "—",
    last_90d: google.reviews_aggregate.reviews_90d ?? "—",
    trend: classifyTrend(
      google.reviews_aggregate.velocity_30d_per_month,
      google.reviews_aggregate.velocity_180d_per_month,
    ),
    trend_glyph: trendGlyph(
      classifyTrend(
        google.reviews_aggregate.velocity_30d_per_month,
        google.reviews_aggregate.velocity_180d_per_month,
      ),
    ),
  };

  const compRows: CompetitorRowVM[] = competitors.competitors.map((c) => ({
    rank: String(c.rank).padStart(2, "0"),
    name: pickPrimaryName(c.google.business.name, language),
    name_secondary: pickSecondaryName(c.google.business, language),
    address: shortAddress(c.google.business),
    is_you: false,
    score: computeAuditScore(c.google, competitors, benchmarks).total,
    rating_display: `${c.google.reviews_aggregate.rating.toFixed(1)} ★`,
    total_count: c.google.reviews_aggregate.total_count,
    last_30d: c.google.reviews_aggregate.reviews_30d ?? "—",
    last_90d: c.google.reviews_aggregate.reviews_90d ?? "—",
    trend: classifyTrend(
      c.google.reviews_aggregate.velocity_30d_per_month,
      c.google.reviews_aggregate.velocity_180d_per_month,
    ),
    trend_glyph: trendGlyph(
      classifyTrend(
        c.google.reviews_aggregate.velocity_30d_per_month,
        c.google.reviews_aggregate.velocity_180d_per_month,
      ),
    ),
  }));

  const all = [...compRows, youRow].sort((a, b) => b.score - a.score);
  return all.map((row, idx) => ({
    ...row,
    // Competitor listings are often keyword-stuffed names that wrap the
    // narrow column character-by-character. Clamp to keep the table readable.
    name: clampName(row.name),
    name_secondary: row.name_secondary ? clampName(row.name_secondary) : row.name_secondary,
    rank: row.is_you ? t.you_tag : String(idx + 1).padStart(2, "0"),
  }));
}

/** Trim an over-long business name (keyword-stuffed listings) to a readable
 *  length, with an ellipsis. Code-point safe for CJK. */
function clampName(name: string, max = 24): string {
  const chars = [...name.trim()];
  return chars.length > max ? `${chars.slice(0, max).join("").trim()}…` : name.trim();
}

function classifyTrend(
  v30: number | null,
  v180: number | null,
): "up" | "down" | "flat" {
  if (v30 == null || v180 == null) return "flat";
  if (v30 > v180 + 0.2) return "up";
  if (v30 < v180 - 0.2) return "down";
  return "flat";
}

function trendGlyph(t: "up" | "down" | "flat"): string {
  return t === "up" ? "↗" : t === "down" ? "↘" : "→";
}

function buildCompetitorDiagnosis(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  if (competitors.competitors.length === 0) return t.competitor_diagnosis_empty;

  const top = competitors.competitors[0];
  const topVelocity = top.google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const youVelocity = google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const multiple = youVelocity > 0 ? topVelocity / youVelocity : topVelocity;

  return t.competitor_diagnosis({
    top_name: pickPrimaryName(top.google.business.name, language),
    top_velocity: topVelocity,
    you_velocity: youVelocity,
    multiple,
    per_review_value: benchmarks.per_review_value.median_usd,
  });
}

function buildCompetitorClosingLine(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const youCount = google.reviews_aggregate.total_count;
  const lower = competitors.competitors.filter(
    (c) => c.google.reviews_aggregate.total_count < youCount,
  ).length;
  return t.competitor_closing(lower, competitors.competitors.length);
}

// 12-month new-customer gains per action (also summed for the section total).
const CUSTOMER_GAIN = { respond: 10, recover: 6 } as const;

// Review-quantity target by where the business sits in its vertical's velocity
// bands (minimum → optimal_low → optimal_high → aggressive). Each position
// aims at the next meaningful rung so the projected gain is always real:
//   • below optimal_low      → target optimal_high  (climb into the healthy band)
//   • optimal_low..aggressive → target aggressive   (push toward dominant)
//   • at/above aggressive     → +15% stretch         (extend an existing lead)
function reviewVelocityGain(
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): { additionalPerMonth: number; annualReviewGain: number } {
  const hv = benchmarks.healthy_velocity;
  const v = google.reviews_aggregate.velocity_30d_per_month ?? 0;

  let target: number;
  if (v < hv.optimal_low_per_month) {
    target = hv.optimal_high_per_month;
  } else if (v < hv.aggressive_per_month) {
    target = hv.aggressive_per_month;
  } else {
    target = v * 1.15;
  }

  const additionalPerMonth = Math.max(Math.round(target - v), 1);
  return { additionalPerMonth, annualReviewGain: additionalPerMonth * 12 };
}

export interface ActionPlanSummary {
  newReviews: number;
  newCustomers: number;
  reviewAssetValue: number;
  perReviewValue: number;
}

function buildActionPlanSummary(
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): ActionPlanSummary {
  const perReviewValue = benchmarks.per_review_value.median_usd;
  const { annualReviewGain } = reviewVelocityGain(google, benchmarks);
  const newCustomers = CUSTOMER_GAIN.respond + CUSTOMER_GAIN.recover;
  return {
    newReviews: annualReviewGain,
    newCustomers,
    // Asset = the value of the NEW reviews earned over the 12 months.
    reviewAssetValue: annualReviewGain * perReviewValue,
    perReviewValue,
  };
}

function buildActionItems(
  google: AuditGoogleData,
  score: AuditScore,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
  language: AuditLanguage,
): ActionItemVM[] {
  const t = LABELS[language];
  const unanswered = google.reviews_aggregate.unanswered_count ?? Math.round(google.reviews_aggregate.total_count * 0.7);
  const { additionalPerMonth, annualReviewGain } = reviewVelocityGain(google, benchmarks);

  const items: Array<{
    title: string;
    why: string;
    result_value: string;
    owner_label: string;
    owner_is_baam: boolean;
    year_result_value: string;
    year_result_label: string;
  }> = [
    {
      title: t.actions.post_visit.title,
      why: t.actions.post_visit.why,
      result_value: t.actions.post_visit.result(additionalPerMonth),
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      year_result_value: `+${annualReviewGain}`,
      year_result_label: t.actions.result_year_reviews,
    },
    {
      title: t.actions.respond.title,
      why: t.actions.respond.why,
      result_value: t.actions.respond.result,
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      year_result_value: `+${CUSTOMER_GAIN.respond}`,
      year_result_label: t.actions.result_year_customers,
    },
    {
      title: t.actions.recover.title(unanswered),
      why: t.actions.recover.why,
      result_value: t.actions.recover.result,
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      year_result_value: `+${CUSTOMER_GAIN.recover}`,
      year_result_label: t.actions.result_year_customers,
    },
  ];

  void score;
  void competitors;

  return items.map((item, idx) => ({
    numeral: ROMAN[idx],
    title: item.title,
    why: item.why,
    result_label: t.actions.result_label,
    result_value: item.result_value,
    owner_label: item.owner_label,
    owner_is_baam: item.owner_is_baam,
    year_result_value: item.year_result_value,
    year_result_label: item.year_result_label,
  }));
}

const ROMAN = ["i", "ii", "iii", "iv", "v"];

function buildAppendixValueRows(
  highlightVertical: VerticalKey,
  language: AuditLanguage,
): AppendixValueRowVM[] {
  const t = LABELS[language];
  return APPENDIX_VALUE_DATA.map((row) => ({
    vertical_display: t.appendix_vertical[row.key] ?? row.key,
    value_range_display: row.range,
    median_display: row.median,
    is_highlight: row.matches.includes(highlightVertical),
  }));
}

function buildAppendixVelocityRows(
  highlightVertical: VerticalKey,
  language: AuditLanguage,
): AppendixVelocityRowVM[] {
  const t = LABELS[language];
  return APPENDIX_VELOCITY_DATA.map((row) => ({
    vertical_display: t.appendix_vertical[row.key] ?? row.key,
    minimum: row.minimum,
    optimal_display: row.optimal,
    aggressive_display: row.aggressive,
    is_highlight: row.matches.includes(highlightVertical),
  }));
}

const APPENDIX_VALUE_DATA: Array<{
  key: string;
  range: string;
  median: string;
  matches: VerticalKey[];
}> = [
  { key: "cafe", range: "$30 – $180", median: "$105", matches: ["cafe", "restaurant"] },
  { key: "salon_spa", range: "$120 – $600", median: "$360", matches: ["salon_spa"] },
  { key: "apparel", range: "$80 – $700", median: "$390", matches: ["apparel"] },
  { key: "health_food", range: "$150 – $1,200", median: "$675", matches: ["health_food"] },
  { key: "insurance", range: "$300 – $1,800", median: "$1,050", matches: ["insurance"] },
  { key: "tcm_clinic", range: "$400 – $2,400", median: "$1,400", matches: ["tcm_clinic", "dental"] },
  { key: "hotel", range: "$300 – $2,800", median: "$1,550", matches: ["hotel"] },
  { key: "auto", range: "$500 – $5,000+", median: "$2,750", matches: ["auto"] },
  { key: "contractor", range: "$600 – $6,000+", median: "$3,300", matches: ["contractor"] },
  { key: "real_estate", range: "$1,500 – $8,000+", median: "$4,750", matches: ["real_estate"] },
  { key: "legal_immigration", range: "$1,200 – $12,000+", median: "$6,600", matches: ["legal_immigration"] },
];

const APPENDIX_VELOCITY_DATA: Array<{
  key: string;
  minimum: number;
  optimal: string;
  aggressive: string;
  matches: VerticalKey[];
}> = [
  { key: "cafe", minimum: 4, optimal: "10 – 15", aggressive: "20+", matches: ["cafe", "restaurant"] },
  { key: "salon_spa", minimum: 3, optimal: "8 – 12", aggressive: "15+", matches: ["salon_spa"] },
  { key: "apparel", minimum: 3, optimal: "6 – 10", aggressive: "12+", matches: ["apparel"] },
  { key: "health_food", minimum: 2, optimal: "4 – 7", aggressive: "8+", matches: ["health_food"] },
  { key: "insurance", minimum: 1, optimal: "3 – 5", aggressive: "6+", matches: ["insurance"] },
  { key: "tcm_clinic", minimum: 2, optimal: "4 – 8", aggressive: "10+", matches: ["tcm_clinic", "dental"] },
  { key: "hotel", minimum: 6, optimal: "12 – 20", aggressive: "25+", matches: ["hotel"] },
  { key: "auto", minimum: 3, optimal: "6 – 10", aggressive: "12+", matches: ["auto"] },
  { key: "contractor", minimum: 2, optimal: "5 – 8", aggressive: "10+", matches: ["contractor"] },
  { key: "real_estate", minimum: 1, optimal: "3 – 5", aggressive: "6+", matches: ["real_estate"] },
  { key: "legal_immigration", minimum: 1, optimal: "3 – 5", aggressive: "6+", matches: ["legal_immigration"] },
];

// ===================================================================
// Service Opportunity projection — simple, defensible model used in the
// "§ Service Opportunity" section that sits between Page 6 and Page 7.
//
// Lift bands by starting grade:
//   F (0-39):  90d +12-22  ·  180d +20-32  ·  12mo +28-42  (most room to grow)
//   D (40-59): 90d +10-18  ·  180d +16-26  ·  12mo +24-36
//   C (60-74): 90d +6-14   ·  180d +10-20  ·  12mo +16-26  ← typical
//   B (75-89): 90d +3-8    ·  180d +5-12   ·  12mo +8-16   (less headroom)
//   A (90+):   90d +1-4    ·  180d +2-6    ·  12mo +3-8    (mostly maintenance)
// Caps each at 95 so we never project unrealistic perfection.
// ===================================================================

interface LiftBand {
  d90: [number, number];
  d180: [number, number];
  m12: [number, number];
}

const LIFT_BANDS_BY_GRADE: Record<"A" | "B" | "C" | "D" | "F", LiftBand> = {
  F: { d90: [12, 22], d180: [20, 32], m12: [28, 42] },
  D: { d90: [10, 18], d180: [16, 26], m12: [24, 36] },
  C: { d90: [6, 14], d180: [10, 20], m12: [16, 26] },
  B: { d90: [3, 8], d180: [5, 12], m12: [8, 16] },
  A: { d90: [1, 4], d180: [2, 6], m12: [3, 8] },
};

const MAX_PROJECTED_SCORE = 95;

function projectRange(
  start: number,
  lift: [number, number],
): { low: number; high: number; display: string } {
  const low = Math.min(start + lift[0], MAX_PROJECTED_SCORE);
  const high = Math.min(start + lift[1], MAX_PROJECTED_SCORE);
  return { low, high, display: `${low}–${high}` };
}

function gradeForScore(s: number): "A" | "B" | "C" | "D" | "F" {
  if (s >= 90) return "A";
  if (s >= 75) return "B";
  if (s >= 60) return "C";
  if (s >= 40) return "D";
  return "F";
}

function buildServiceOpportunity(
  startingScore: number,
  startingGrade: "A" | "B" | "C" | "D" | "F",
  auditId: string,
): ServiceOpportunityVM {
  const band = LIFT_BANDS_BY_GRADE[startingGrade];

  const d90 = projectRange(startingScore, band.d90);
  const d180 = projectRange(startingScore, band.d180);
  const m12 = projectRange(startingScore, band.m12);

  // Self-Serve: bottom-of-band lift (owner-driven, less consistent)
  const selfBand: [number, number] = [
    band.d90[0],
    Math.round((band.d90[0] + band.d90[1]) / 2),
  ];
  const selfD90 = projectRange(startingScore, selfBand);

  const d90Grade = gradeForScore(d90.high);
  const d180Grade = gradeForScore(d180.high);
  const m12Grade = gradeForScore(m12.high);

  return {
    starting_score: startingScore,
    starting_grade: startingGrade,
    d90_display: d90.display,
    d90_grade: d90Grade,
    d90_grade_label_en: `Entering Grade ${d90Grade} · velocity recovered`,
    d90_grade_label_zh: `進入 ${d90Grade} 級 · 速度回升`,
    d180_display: d180.display,
    d180_grade: d180Grade,
    d180_grade_label_en: `Solid Grade ${d180Grade} · competitor gap closing`,
    d180_grade_label_zh: `穩固 ${d180Grade} 級 · 縮小與競爭對手差距`,
    m12_display: m12.display,
    m12_grade: m12Grade,
    m12_grade_label_en:
      m12Grade === "A"
        ? "Grade A · 5× Return Standard hit"
        : `Grade ${m12Grade} · sustained growth`,
    m12_grade_label_zh:
      m12Grade === "A"
        ? "A 級 · 達成 5× 回報標準"
        : `${m12Grade} 級 · 持續成長`,
    self_d90_display: selfD90.display,
    full_d90_display: d90.display,
    audit_id: auditId,
  };
}
