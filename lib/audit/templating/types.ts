import type { AuditCompetitorsData } from "../competitors/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditPlatformsData } from "../platforms/types";
import type { AuditProjection } from "../projection/types";
import type { AuditScore } from "../scoring/types";

export type AuditLanguage = "en" | "zh";

export interface RenderAuditInput {
  google: AuditGoogleData;
  competitors: AuditCompetitorsData;
  score: AuditScore;
  projection: AuditProjection;
  benchmarks: VerticalBenchmarks;
  platforms?: AuditPlatformsData;
  tier: "free" | "paid";
  language?: AuditLanguage;
  audit_id?: string;
  prepared_at?: Date;
}

export interface RenderAuditOutput {
  pdf_buffer: Uint8Array;
  pdf_path?: string;
  page_count: number;
  generation_time_ms: number;
  language: AuditLanguage;
}

export interface AuditViewModel {
  language: AuditLanguage;
  audit_id: string;
  audit_date_display: string;

  business_name: string;
  business_name_secondary: string;
  business_address_line_1: string;
  business_address_line_2: string;
  vertical_display_name: string;
  vertical_subtype: string;

  doc_header_subtitle_left: string;

  page_count_display: string;
  is_paid: boolean;

  snapshot_google: PlatformRowVM;
  snapshot_yelp: PlatformRowVM | null;
  insight_callout_html: string;

  score_total: number;
  score_grade: "A" | "B" | "C" | "D" | "F";
  score_grade_diagnosis: string;
  subscore_rows: SubscoreRowVM[];

  projection_svg: string;
  projection_six_month_score: number;
  projection_six_month_grade: "A" | "B" | "C" | "D" | "F";
  projection_six_month_drop_display: string;
  projection_ranking_drop_display: string;
  projection_revenue_loss_display: string;
  projection_floor_blurb: string;

  // Section 4 — Benchmarks (paid only)
  per_review_value_median_display: string;
  per_review_value_range_display: string;
  velocity_band_silent: string;
  velocity_band_min: string;
  velocity_band_optimal: string;
  velocity_band_aggressive: string;
  velocity_pointer_pct: number;
  velocity_pointer_label: string;
  money_on_table_html: string;

  // Section 5 — Competitors (paid only)
  competitor_rows: CompetitorRowVM[];
  competitor_diagnosis_html: string;
  competitor_closing_line: string;

  // Section 6 — Action Plan (paid only)
  action_items: ActionItemVM[];
  total_value_added_display: string;
  total_value_lost_display: string;

  // Section 7 — Appendix (paid only)
  appendix_value_rows: AppendixValueRowVM[];
  appendix_velocity_rows: AppendixVelocityRowVM[];

  // Translation strings (precomputed for template consumption)
  t: TranslatedStrings;
}

export interface TranslatedStrings {
  cover_eyebrow: string;
  cover_title_html: string;
  cover_subtitle: string;
  cover_meta_labels: { business: string; location: string; vertical: string; audit_id: string };
  cover_meta_subtitle: string;
  hook_quote_html: string;
  section_titles: { "01": string; "02": string; "03": string; "04": string; "05": string; "06": string; A: string };
  section_headlines: { "01": string; "02": string };
  section_decks: { "01": string; "02": string };
  snapshot_table_headers: { platform: string; rating: string; reviews: string; last_review: string; health: string };
  paid_only_row: string;
  methodology_eyebrow: string;
  methodology_text_html: string;
  velocity_drag_line_html: string;
  forecast_eyebrow: string;
  projection_title_html: string;
  projection_deck: string;
  projection_legend_lines: string[];
  projection_impact_labels: { score: string; ranking: string; revenue: string };
  ranking_drop_sub: string;
  revenue_loss_sub: string;
  grade_scale_eyebrow: string;
  grade_scale_headline_html: string;
  grade_scale_headers: { range: string; grade: string; meaning: string };
  grade_scale_table: Array<{ range: string; grade: string; meaning: string; class: string }>;
  you_tag: string;
  page_label_1: string;
  page_label_2: string;
  page_label_3: string;
  page_label_4: string;
  page_label_5: string;
  page_label_6: string;
  page_label_7: string;
  upgrade_cta_section_num: string;
  upgrade_cta_title: string;
  upgrade_cta_headline_html: string;
  upgrade_cta_items: string[];
  upgrade_cta_closing: string;
  section_4_headline_html: string;
  section_4_deck: string;
  benchmark_panel_a_eyebrow: string;
  benchmark_panel_a_title: string;
  benchmark_panel_a_detail_html: string;
  benchmark_panel_a_methodology: string;
  benchmark_panel_a_range_prefix: string;
  benchmark_panel_a_horizon_suffix: string;
  benchmark_panel_b_eyebrow: string;
  benchmark_panel_b_title_html: string;
  benchmark_panel_b_detail_html: string;
  money_on_table_eyebrow: string;
  section_5_headline_html: string;
  section_5_deck: string;
  competitor_table_headers: { business: string; score: string; rating: string; total: string; last_30d: string; last_90d: string; trend: string };
  section_6_headline_html: string;
  section_6_deck: string;
  summary_block_html: string;
  cta_eyebrow: string;
  cta_headline_html: string;
  cta_self: { label: string; title: string; price: string; desc: string };
  cta_full: { label: string; title: string; price: string; desc: string };
  cta_promise_html: string;
  appendix_section_title: string;
  appendix_section_headline_html: string;
  appendix_section_deck_html: string;
  appendix_a1_eyebrow: string;
  appendix_a1_title: string;
  appendix_a1_deck: string;
  appendix_a1_headers: { vertical: string; range: string; median: string };
  appendix_a2_eyebrow: string;
  appendix_a2_title: string;
  appendix_a2_deck: string;
  appendix_a2_headers: { vertical: string; minimum: string; optimal: string; aggressive: string };
  appendix_source_html: string;
  appendix_citations_prefix: string;
  appendix_closing_quote_html: string;
  end_label: string;
  brand_label: string;
  vol_label: string;
  date_prefix: string;
  grade_label_prefix: string;
  score_breakdown_label: string;
  ranking_position_sub: string;
  revenue_cost_sub: string;
  range_prefix: string;
}

export interface PlatformRowVM {
  icon: string;
  name: string;
  meta_sub: string;
  rating_stars_html: string;
  rating_value: string;
  review_count: number;
  last_review_label: string;
  last_review_is_stale: boolean;
  health_label: string;
  health_class: "good" | "warn" | "missing";
}

export interface SubscoreRowVM {
  label: string;
  raw_value_html: string;
  footnote: string;
  fill_pct: number;
  fill_class: "" | "weak" | "strong";
  marks: MarkVM[];
  scale_ticks: ScaleTickVM[];
  score: number;
  weight_pct: number;
}

export interface MarkVM {
  left_pct: number;
}

export interface ScaleTickVM {
  label: string;
  position: "anchor-left" | "anchor-right" | "key";
  left_pct?: number;
}

export interface CompetitorRowVM {
  rank: string;
  name: string;
  name_secondary: string;
  is_you: boolean;
  score: number;
  rating_display: string;
  total_count: number;
  last_30d: number | string;
  last_90d: number | string;
  trend: "up" | "down" | "flat";
  trend_glyph: string;
}

export interface ActionItemVM {
  numeral: string;
  title: string;
  why: string;
  result_label: string;
  result_value: string;
  owner_label: string;
  owner_is_baam: boolean;
  value_amount_display: string;
  value_label: string;
  value_calc_html: string;
}

export interface AppendixValueRowVM {
  vertical_display: string;
  value_range_display: string;
  median_display: string;
  is_highlight: boolean;
}

export interface AppendixVelocityRowVM {
  vertical_display: string;
  minimum: number;
  optimal_display: string;
  aggressive_display: string;
  is_highlight: boolean;
}
