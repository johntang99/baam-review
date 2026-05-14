/**
 * Pure helpers for the Analytics & Review Revenue tab.
 *
 * Two buckets:
 *   1. Referral revenue — DIRECT. Tracked `offer_book_click` events × close rate × ticket.
 *   2. New review revenue — MODELED. Estimated profile-view lift × attribution share
 *      × industry-default conversion rate × ticket.
 *
 * Profile-view lift can come from Google Business Profile Performance API when
 * connected; until then we use new_reviews × DEFAULT_VIEWS_PER_REVIEW as a
 * conservative industry default (BrightLocal 2024 median).
 */

export const DEFAULT_VIEWS_PER_REVIEW = 40;
export const DEFAULT_CONVERSION_RATE = 0.01;
export const MODELED_RANGE = 0.35;

export interface RevenueInputs {
  ticketCents: number;          // avg first-visit ticket
  ltvCents: number;             // avg 12-month lifetime value per customer
  closeRate: number;            // 0-1, default 0.5
  attributionShare: number;     // 0-1, default 0.5
}

export interface PeriodData {
  bookClicks: number;
  newReviewsAtLeast4Star: number;
  /**
   * Optional GBP profile view delta. If null we fall back to
   * new_reviews × DEFAULT_VIEWS_PER_REVIEW.
   */
  profileViewLift: number | null;
}

export interface BucketResult {
  /** Revenue this period in dollars (already converted from cents). */
  revenue: number;
  /** Estimated new customers gained. */
  customers: number;
  /** customers × ltv (in dollars). */
  lifetimeValue: number;
  /** Lower bound — same as revenue for direct buckets. */
  revenueLow: number;
  revenueHigh: number;
  ltvLow: number;
  ltvHigh: number;
}

export interface RevenueResult {
  referrals: BucketResult;
  reviews: BucketResult;
  /** Sum across buckets. */
  periodRevenue: number;
  periodRevenueLow: number;
  periodRevenueHigh: number;
  totalCustomers: number;
  totalLifetimeValue: number;
  totalLifetimeValueLow: number;
  totalLifetimeValueHigh: number;
  /** Profile-view input used in the review bucket (resolved value). */
  resolvedViewLift: number;
  /** True when resolvedViewLift came from the GBP API rather than the default. */
  viewLiftIsTracked: boolean;
  /** Attributed slice of resolvedViewLift after applying attributionShare. */
  attributedViews: number;
}

function clampToZero(n: number): number {
  return n < 0 ? 0 : n;
}

export function computeRevenue(
  inputs: RevenueInputs,
  data: PeriodData,
): RevenueResult {
  const ticket = inputs.ticketCents / 100;
  const ltv = inputs.ltvCents / 100;

  // Referrals — direct
  const refCustomers = data.bookClicks * inputs.closeRate;
  const refRevenue = refCustomers * ticket;
  const refLtv = refCustomers * ltv;

  // Reviews — modeled
  const resolvedViewLift =
    data.profileViewLift !== null
      ? clampToZero(data.profileViewLift)
      : clampToZero(data.newReviewsAtLeast4Star) * DEFAULT_VIEWS_PER_REVIEW;
  const viewLiftIsTracked = data.profileViewLift !== null;
  const attributedViews = resolvedViewLift * inputs.attributionShare;
  const revCustomers = attributedViews * DEFAULT_CONVERSION_RATE;
  const revRevenue = revCustomers * ticket;
  const revLtv = revCustomers * ltv;

  const revLow = revRevenue * (1 - MODELED_RANGE);
  const revHigh = revRevenue * (1 + MODELED_RANGE);
  const revLtvLow = revLtv * (1 - MODELED_RANGE);
  const revLtvHigh = revLtv * (1 + MODELED_RANGE);

  const referrals: BucketResult = {
    revenue: refRevenue,
    customers: refCustomers,
    lifetimeValue: refLtv,
    revenueLow: refRevenue,
    revenueHigh: refRevenue,
    ltvLow: refLtv,
    ltvHigh: refLtv,
  };
  const reviews: BucketResult = {
    revenue: revRevenue,
    customers: revCustomers,
    lifetimeValue: revLtv,
    revenueLow: revLow,
    revenueHigh: revHigh,
    ltvLow: revLtvLow,
    ltvHigh: revLtvHigh,
  };

  return {
    referrals,
    reviews,
    periodRevenue: refRevenue + revRevenue,
    periodRevenueLow: refRevenue + revLow,
    periodRevenueHigh: refRevenue + revHigh,
    totalCustomers: refCustomers + revCustomers,
    totalLifetimeValue: refLtv + revLtv,
    totalLifetimeValueLow: refLtv + revLtvLow,
    totalLifetimeValueHigh: refLtv + revLtvHigh,
    resolvedViewLift,
    viewLiftIsTracked,
    attributedViews,
  };
}

export function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
