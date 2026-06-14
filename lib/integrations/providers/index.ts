import "server-only";
import { shopifyAdapter } from "./shopify";
import { calendlyAdapter } from "./calendly";
import { acuityAdapter } from "./acuity";

/**
 * Native connector adapters (Phase 4). Each adapter translates ONE vendor's
 * native webhook payload into our contact shape, so a client can point their
 * existing tool's webhook straight at us — no Zapier, no OAuth — for vendors
 * whose payload already carries the customer's contact.
 *
 *   POST /api/integrations/<provider>?key=<location API key>
 *
 * Adding a connector = one small adapter file here. Vendors that DON'T include
 * the contact in the webhook (e.g. Square/Acuity, which return a customer_id
 * needing an API fetch) require OAuth and are a separate, later build.
 */

/** Normalized contact extracted from a vendor payload (→ enqueueReviewRequest). */
export interface MappedContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  service?: string | null;
  externalId?: string | null;
  transactedAt?: string | null;
}

export interface ProviderAdapter {
  id: string;
  label: string;
  /** Webhook body content type. Default "json"; Acuity posts "form". */
  parse?: "json" | "form";
  /** True for fetch-based providers (need stored credentials + an API call to
   *  resolve the customer, e.g. Acuity). The route loads the location's
   *  connection and passes its credentials to `resolve`. */
  needsConnection?: boolean;
  /**
   * Direct providers: map a parsed webhook body → contact synchronously, or
   * null to IGNORE the event. Headers carry the event type for some vendors
   * (e.g. Shopify's `x-shopify-topic`).
   */
  map?: (body: unknown, headers: Headers) => MappedContact | null;
  /**
   * Fetch-based providers: resolve the contact using stored credentials (an
   * API call to the vendor). Return null to ignore the event.
   */
  resolve?: (
    body: unknown,
    headers: Headers,
    credentials: Record<string, unknown>,
  ) => Promise<MappedContact | null>;
}

const ADAPTERS: Record<string, ProviderAdapter> = {
  [shopifyAdapter.id]: shopifyAdapter,
  [calendlyAdapter.id]: calendlyAdapter,
  [acuityAdapter.id]: acuityAdapter,
};

export function getProviderAdapter(id: string): ProviderAdapter | null {
  return ADAPTERS[id] ?? null;
}

export function listProviderIds(): string[] {
  return Object.keys(ADAPTERS);
}

/** Small helpers shared by adapters. */
export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
