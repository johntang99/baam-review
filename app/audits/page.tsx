import { permanentRedirect } from "next/navigation";

export default function AuditsLegacyRedirect() {
  // The /audits route was renamed to /audit/list as part of the audit
  // namespace consolidation. 308 keeps old bookmarks / email links working.
  permanentRedirect("/audit/list");
}
