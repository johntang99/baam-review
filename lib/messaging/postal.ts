import "server-only";

/**
 * The physical postal address to print in an email footer (CAN-SPAM). Uses the
 * location's own address; falls back to a company-wide address (BAAM_POSTAL_ADDRESS
 * env) so every outbound email is compliant even if a location hasn't set one.
 * Returns undefined only when neither is available — surface a "set your
 * address" nudge in Location Setup in that case.
 */
export function postalAddress(
  locationAddress: string | null | undefined,
): string | undefined {
  return (
    locationAddress?.trim() ||
    process.env.BAAM_POSTAL_ADDRESS?.trim() ||
    undefined
  );
}
