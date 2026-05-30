import type { AuditCompetitor, AuditCompetitorsData } from "../competitors/types";
import type { AuditGoogleData, VerticalKey } from "../google/types";
import type { AuditProjection } from "../projection/types";
import type { AuditScore, ScoreComponent } from "../scoring/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
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
    vertical_display_name: t.verticals[google.vertical.inferred_vertical] ?? t.verticals.general_smb,
    vertical_subtype: formatVerticalSubtype(google, language),

    doc_header_subtitle_left: t.doc_header_subtitle,

    page_count_display: tier === "paid" ? "07" : "03",
    is_paid: tier === "paid",

    snapshot_google: buildGooglePlatformRow(google, language),
    insight_callout_html: buildInsightCallout(google, score, language),

    score_total: score.total,
    score_grade: score.grade,
    score_grade_diagnosis: t.grade_diagnoses[score.grade],
    subscore_rows: buildSubscoreRows(score, benchmarks.weights, language),

    projection_svg: renderProjectionSvg(projection, score.total),
    projection_six_month_score: projection.six_month.do_nothing_score,
    projection_six_month_grade: projection.six_month.do_nothing_grade,
    projection_six_month_drop_display: `${score.total} → ${projection.six_month.do_nothing_score}`,
    projection_ranking_drop_display: formatRankingDrop(projection.ranking_estimate.do_nothing_six_month_drop, language),
    projection_revenue_loss_display: `$${projection.revenue_impact.six_month_loss_usd.toLocaleString()}`,
    projection_floor_blurb: buildProjectionFloorBlurb(score, projection, language),

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

    competitor_rows: buildCompetitorRows(google, competitors, score, benchmarks, language),
    competitor_diagnosis_html: buildCompetitorDiagnosis(google, competitors, benchmarks, language),
    competitor_closing_line: buildCompetitorClosingLine(google, competitors, language),

    action_items: buildActionItems(google, score, competitors, benchmarks, language),
    total_value_added_display: buildTotalValueAddedDisplay(google, score, competitors, benchmarks),
    total_value_lost_display: `$${projection.revenue_impact.six_month_loss_usd.toLocaleString()}`,

    appendix_value_rows: buildAppendixValueRows(google.vertical.inferred_vertical, language),
    appendix_velocity_rows: buildAppendixVelocityRows(google.vertical.inferred_vertical, language),

    t: buildTranslatedStrings(language, {
      page_count_display: tier === "paid" ? "07" : "03",
      score_grade: score.grade,
      vertical_display_name: t.verticals[google.vertical.inferred_vertical] ?? t.verticals.general_smb,
      per_review_value_median_display: `$${benchmarks.per_review_value.median_usd.toLocaleString()}`,
      per_review_value_range_display: `$${benchmarks.per_review_value.range_low_usd.toLocaleString()} — $${benchmarks.per_review_value.range_high_usd.toLocaleString()}`,
      total_value_added_display: buildTotalValueAddedDisplay(google, score, competitors, benchmarks),
      total_value_lost_display: `$${projection.revenue_impact.six_month_loss_usd.toLocaleString()}`,
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
    total_value_added_display: string;
    total_value_lost_display: string;
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
    summary_block_html: s.summary_block_html(ctx.total_value_added_display, ctx.total_value_lost_display),
    cta_eyebrow: s.cta_eyebrow,
    cta_headline_html: s.cta_headline_html,
    cta_self: s.cta_self,
    cta_full: s.cta_full,
    cta_promise_html: s.cta_promise_html,
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
  if (language === "zh" && cjk) return cjk;
  return ascii || fullName;
}

function pickSecondaryName(
  business: AuditGoogleData["business"],
  language: AuditLanguage,
): string {
  const ascii = business.name.replace(/[^\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  const cjk = business.name.replace(/[\x00-\x7F]+/g, "").replace(/[()（）]/g, "").trim();
  if (language === "zh") return ascii;
  return cjk;
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

function renderStarsHtml(rating: number): string {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const stars = "★".repeat(full);
  const half = hasHalf ? "★" : "☆";
  const empty = "☆".repeat(Math.max(0, 5 - full - (hasHalf ? 1 : 0)));
  return `<span class="stars">${stars}</span>${half}${empty}`;
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

function formatRankingDrop(drop: number, language: AuditLanguage): string {
  const t = LABELS[language];
  if (drop === 0) return t.ranking_hold;
  const abs = Math.abs(drop);
  return `${drop > 0 ? "+" : "−"}${abs} to ${drop > 0 ? "+" : "−"}${abs + 1}`;
}

function buildProjectionFloorBlurb(
  score: AuditScore,
  projection: AuditProjection,
  language: AuditLanguage,
): string {
  const t = LABELS[language];
  const droppedGrade = projection.six_month.do_nothing_grade !== score.grade;
  if (!droppedGrade) return t.projection_floor.same_grade;
  return t.projection_floor.dropped(score.grade, projection.six_month.do_nothing_grade);
}

function computeVelocityPointerPct(
  velocity: number | null,
  benchmarks: VerticalBenchmarks,
): number {
  const v = velocity ?? 0;
  const ceiling = benchmarks.healthy_velocity.aggressive_per_month * 1.1;
  const pct = (v / ceiling) * 100;
  return Math.max(0, Math.min(100, pct));
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
    is_you: false,
    score: roughScoreEstimate(c, benchmarks),
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
    rank: row.is_you ? t.you_tag : String(idx + 1).padStart(2, "0"),
  }));
}

function roughScoreEstimate(c: AuditCompetitor, benchmarks: VerticalBenchmarks): number {
  const rating = c.google.reviews_aggregate.rating;
  const count = c.google.reviews_aggregate.total_count;
  const v30 = c.google.reviews_aggregate.velocity_30d_per_month ?? 0;

  let ratingScore = 50;
  for (const anchor of benchmarks.rubric.rating.curve) {
    if (rating >= anchor.rating) ratingScore = anchor.score;
  }
  let volumeScore = 0;
  for (const anchor of benchmarks.rubric.volume.thresholds) {
    if (count >= anchor.count) volumeScore = anchor.score;
  }
  let v30Score = 0;
  for (const anchor of benchmarks.rubric.velocity.thresholds) {
    if (v30 >= anchor.per_month) v30Score = anchor.score;
  }

  return Math.round(ratingScore * 0.35 + volumeScore * 0.3 + v30Score * 0.35);
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

function buildActionItems(
  google: AuditGoogleData,
  score: AuditScore,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
  language: AuditLanguage,
): ActionItemVM[] {
  const t = LABELS[language];
  const perReviewValue = benchmarks.per_review_value.median_usd;
  const unanswered = google.reviews_aggregate.unanswered_count ?? Math.round(google.reviews_aggregate.total_count * 0.7);

  const additionalPerMonth = Math.max(
    benchmarks.healthy_velocity.optimal_low_per_month - (google.reviews_aggregate.velocity_30d_per_month ?? 0),
    1,
  );
  const annualReviewGain = Math.round(additionalPerMonth * 12);
  const action1Value = annualReviewGain * perReviewValue;

  const items: Array<{
    title: string;
    why: string;
    result_value: string;
    owner_label: string;
    owner_is_baam: boolean;
    value_amount: number;
    value_label: string;
    value_calc_html: string;
  }> = [
    {
      title: t.actions.post_visit.title,
      why: t.actions.post_visit.why,
      result_value: t.actions.post_visit.result(additionalPerMonth),
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      value_amount: action1Value,
      value_label: t.actions.value_12mo,
      value_calc_html: `${annualReviewGain} ${t.actions.reviews_per_year} × <strong>$${perReviewValue.toLocaleString()}</strong><br>${t.actions.per_review_value_label}`,
    },
    {
      title: t.actions.respond.title,
      why: t.actions.respond.why,
      result_value: t.actions.respond.result,
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      value_amount: Math.round(perReviewValue * 10),
      value_label: t.actions.value_12mo,
      value_calc_html: `+10 ${t.actions.customers} × <strong>$${perReviewValue.toLocaleString()}</strong><br>${t.actions.ltv_label}`,
    },
    {
      title: t.actions.profile.title,
      why: t.actions.profile.why,
      result_value: t.actions.profile.result,
      owner_label: t.actions.owner_you,
      owner_is_baam: false,
      value_amount: Math.round(perReviewValue * 16),
      value_label: t.actions.value_12mo,
      value_calc_html: `+16 ${t.actions.customers} × <strong>$${perReviewValue.toLocaleString()}</strong><br>${t.actions.ltv_label}`,
    },
    {
      title: t.actions.recover.title(unanswered),
      why: t.actions.recover.why,
      result_value: t.actions.recover.result,
      owner_label: t.actions.owner_baam,
      owner_is_baam: true,
      value_amount: Math.round(perReviewValue * 6),
      value_label: t.actions.value_12mo,
      value_calc_html: `+6 ${t.actions.customers} × <strong>$${perReviewValue.toLocaleString()}</strong><br>${t.actions.ltv_label}`,
    },
    {
      title: t.actions.widget.title,
      why: t.actions.widget.why,
      result_value: t.actions.widget.result,
      owner_label: t.actions.owner_baam_platform,
      owner_is_baam: false,
      value_amount: Math.round(perReviewValue * 7),
      value_label: t.actions.value_12mo,
      value_calc_html: `+7 ${t.actions.customers} × <strong>$${perReviewValue.toLocaleString()}</strong><br>${t.actions.ltv_label}`,
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
    value_amount_display: `+$${item.value_amount.toLocaleString()}`,
    value_label: item.value_label,
    value_calc_html: item.value_calc_html,
  }));
}

const ROMAN = ["i", "ii", "iii", "iv", "v"];

function buildTotalValueAddedDisplay(
  google: AuditGoogleData,
  score: AuditScore,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
): string {
  const items = buildActionItems(google, score, competitors, benchmarks, "en");
  let total = 0;
  for (const item of items) {
    const m = item.value_amount_display.match(/[\d,]+/);
    if (m) total += parseInt(m[0].replace(/,/g, ""), 10);
  }
  return `+$${total.toLocaleString()}`;
}

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
