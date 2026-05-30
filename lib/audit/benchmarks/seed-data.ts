import type { VerticalKey } from "../google/types";
import type {
  VerticalBenchmarks,
  RatingRubric,
  VolumeRubric,
  VelocityRubric,
} from "./types";

const VERSION = "1.0.0";
const SOURCE = "baamreview.com/review-value.html";
const EFFECTIVE_FROM = "2026-05-01T00:00:00Z";

const STANDARD_WEIGHTS = {
  rating_quality: 0.25,
  review_volume: 0.2,
  velocity_30d: 0.25,
  velocity_180d: 0.2,
  velocity_365d: 0.1,
} as const;

const STANDARD_RATING_RUBRIC: RatingRubric = {
  curve: [
    { rating: 3.0, score: 15 },
    { rating: 3.5, score: 35 },
    { rating: 4.0, score: 55 },
    { rating: 4.5, score: 80 },
    { rating: 4.7, score: 88 },
    { rating: 5.0, score: 100 },
  ],
};

const TCM_VOLUME_RUBRIC: VolumeRubric = {
  thresholds: [
    { count: 0, score: 0 },
    { count: 25, score: 35 },
    { count: 50, score: 50 },
    { count: 100, score: 70 },
    { count: 200, score: 85 },
    { count: 300, score: 100 },
  ],
};

const LEGAL_VOLUME_RUBRIC: VolumeRubric = {
  thresholds: [
    { count: 0, score: 0 },
    { count: 10, score: 35 },
    { count: 25, score: 50 },
    { count: 50, score: 70 },
    { count: 100, score: 85 },
    { count: 200, score: 100 },
  ],
};

const TCM_VELOCITY_RUBRIC: VelocityRubric = {
  thresholds: [
    { per_month: 0, score: 0 },
    { per_month: 1, score: 25 },
    { per_month: 2, score: 40 },
    { per_month: 4, score: 75 },
    { per_month: 6, score: 88 },
    { per_month: 8, score: 95 },
    { per_month: 10, score: 100 },
  ],
};

const LEGAL_VELOCITY_RUBRIC: VelocityRubric = {
  thresholds: [
    { per_month: 0, score: 0 },
    { per_month: 0.5, score: 25 },
    { per_month: 1, score: 40 },
    { per_month: 3, score: 75 },
    { per_month: 5, score: 95 },
    { per_month: 6, score: 100 },
  ],
};

interface MarketProfile {
  vertical: VerticalKey;
  median_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  min_per_month: number;
  optimal_low_per_month: number;
  optimal_high_per_month: number;
  aggressive_per_month: number;
  ranking_slide_onset_weeks: number;
  velocity_half_life_days: number;
  ramp_months_with_baam: number;
}

const MARKET_PROFILES: MarketProfile[] = [
  { vertical: "tcm_clinic",        median_usd: 1400, range_low_usd: 400,  range_high_usd: 2400,  min_per_month: 2, optimal_low_per_month: 4,  optimal_high_per_month: 8,  aggressive_per_month: 10, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "dental",            median_usd: 1400, range_low_usd: 400,  range_high_usd: 2400,  min_per_month: 2, optimal_low_per_month: 4,  optimal_high_per_month: 8,  aggressive_per_month: 10, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "legal_immigration", median_usd: 6600, range_low_usd: 1200, range_high_usd: 12000, min_per_month: 1, optimal_low_per_month: 3,  optimal_high_per_month: 5,  aggressive_per_month: 6,  ranking_slide_onset_weeks: 6, velocity_half_life_days: 120, ramp_months_with_baam: 4 },
  { vertical: "restaurant",        median_usd: 105,  range_low_usd: 50,   range_high_usd: 200,   min_per_month: 4, optimal_low_per_month: 10, optimal_high_per_month: 15, aggressive_per_month: 20, ranking_slide_onset_weeks: 2, velocity_half_life_days: 60,  ramp_months_with_baam: 2 },
  { vertical: "salon_spa",         median_usd: 360,  range_low_usd: 150,  range_high_usd: 600,   min_per_month: 3, optimal_low_per_month: 8,  optimal_high_per_month: 12, aggressive_per_month: 15, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "apparel",           median_usd: 390,  range_low_usd: 150,  range_high_usd: 700,   min_per_month: 3, optimal_low_per_month: 6,  optimal_high_per_month: 10, aggressive_per_month: 12, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "health_food",       median_usd: 675,  range_low_usd: 250,  range_high_usd: 1200,  min_per_month: 2, optimal_low_per_month: 4,  optimal_high_per_month: 7,  aggressive_per_month: 8,  ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "insurance",         median_usd: 1050, range_low_usd: 400,  range_high_usd: 2000,  min_per_month: 1, optimal_low_per_month: 3,  optimal_high_per_month: 5,  aggressive_per_month: 6,  ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "hotel",             median_usd: 1550, range_low_usd: 600,  range_high_usd: 3000,  min_per_month: 6, optimal_low_per_month: 12, optimal_high_per_month: 20, aggressive_per_month: 25, ranking_slide_onset_weeks: 2, velocity_half_life_days: 60,  ramp_months_with_baam: 2 },
  { vertical: "auto",              median_usd: 2750, range_low_usd: 800,  range_high_usd: 5000,  min_per_month: 3, optimal_low_per_month: 6,  optimal_high_per_month: 10, aggressive_per_month: 12, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "contractor",        median_usd: 3300, range_low_usd: 1000, range_high_usd: 6000,  min_per_month: 2, optimal_low_per_month: 5,  optimal_high_per_month: 8,  aggressive_per_month: 10, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
  { vertical: "real_estate",       median_usd: 4750, range_low_usd: 1500, range_high_usd: 9000,  min_per_month: 1, optimal_low_per_month: 3,  optimal_high_per_month: 5,  aggressive_per_month: 6,  ranking_slide_onset_weeks: 6, velocity_half_life_days: 120, ramp_months_with_baam: 4 },
  { vertical: "cafe",              median_usd: 105,  range_low_usd: 50,   range_high_usd: 200,   min_per_month: 4, optimal_low_per_month: 10, optimal_high_per_month: 15, aggressive_per_month: 20, ranking_slide_onset_weeks: 2, velocity_half_life_days: 60,  ramp_months_with_baam: 2 },
  { vertical: "general_smb",       median_usd: 105,  range_low_usd: 50,   range_high_usd: 200,   min_per_month: 4, optimal_low_per_month: 10, optimal_high_per_month: 15, aggressive_per_month: 20, ranking_slide_onset_weeks: 3, velocity_half_life_days: 90,  ramp_months_with_baam: 3 },
];

export function buildSeedBenchmarks(): VerticalBenchmarks[] {
  return MARKET_PROFILES.map(buildBenchmarkFromProfile);
}

function buildBenchmarkFromProfile(p: MarketProfile): VerticalBenchmarks {
  const isTcm = p.vertical === "tcm_clinic" || p.vertical === "dental";
  const isLegal = p.vertical === "legal_immigration";

  const volume = isTcm
    ? TCM_VOLUME_RUBRIC
    : isLegal
      ? LEGAL_VOLUME_RUBRIC
      : scaleVolumeRubric(TCM_VOLUME_RUBRIC, p.optimal_low_per_month);

  const velocity = isTcm
    ? TCM_VELOCITY_RUBRIC
    : isLegal
      ? LEGAL_VELOCITY_RUBRIC
      : buildVelocityRubricFromProfile(p);

  return {
    vertical: p.vertical,
    region: "national",
    version: VERSION,
    source: SOURCE,
    effective_from: EFFECTIVE_FROM,
    per_review_value: {
      range_low_usd: p.range_low_usd,
      range_high_usd: p.range_high_usd,
      median_usd: p.median_usd,
      horizon_months: 24,
    },
    healthy_velocity: {
      minimum_per_month: p.min_per_month,
      optimal_low_per_month: p.optimal_low_per_month,
      optimal_high_per_month: p.optimal_high_per_month,
      aggressive_per_month: p.aggressive_per_month,
    },
    rubric: {
      rating: STANDARD_RATING_RUBRIC,
      volume,
      velocity,
    },
    weights: STANDARD_WEIGHTS,
    competitor_baseline: null,
    projection: {
      ranking_slide_onset_weeks: p.ranking_slide_onset_weeks,
      velocity_half_life_days: p.velocity_half_life_days,
      competitor_velocity_default: p.optimal_low_per_month,
      ramp_months_with_baam: p.ramp_months_with_baam,
    },
  };
}

function scaleVolumeRubric(
  base: VolumeRubric,
  targetOptimalLow: number,
): VolumeRubric {
  const tcmOptimalLow = 4;
  const factor = targetOptimalLow / tcmOptimalLow;
  return {
    thresholds: base.thresholds.map((t) => ({
      count: Math.round(t.count * factor),
      score: t.score,
    })),
  };
}

function buildVelocityRubricFromProfile(p: MarketProfile): VelocityRubric {
  const midOptimal = (p.optimal_low_per_month + p.optimal_high_per_month) / 2;
  return {
    thresholds: [
      { per_month: 0, score: 0 },
      { per_month: p.min_per_month / 2, score: 25 },
      { per_month: p.min_per_month, score: 40 },
      { per_month: p.optimal_low_per_month, score: 75 },
      { per_month: midOptimal, score: 88 },
      { per_month: p.optimal_high_per_month, score: 95 },
      { per_month: p.aggressive_per_month, score: 100 },
    ],
  };
}
