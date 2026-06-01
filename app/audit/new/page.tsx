import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { canUserAudit } from "@/lib/audit/quotas";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { IntakeForm } from "./intake-form";

export const metadata = { title: "Start a new audit · BAAM Review" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "Please enter a business to audit.",
  NOT_FOUND: "We couldn't find that business on Google. Try a different name or city.",
  NO_REVIEWS: "That business has no reviews yet — an audit needs at least one review.",
  INVALID_REF: "Please enter a Google Maps URL, Place ID, or business name.",
  monthly_limit: "You've used your 2 audits for this month. Quota resets on the 1st.",
  lifetime_limit: "You've reached your lifetime audit allowance. Contact support to extend, or upgrade to BAAM Review service for unlimited audits.",
};

export default async function NewAuditPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect("/login?next=/audit/new");
  }

  const params = await props.searchParams;
  const errorParam = params.error;
  const error = errorParam
    ? ERRORS[errorParam] ?? decodeURIComponent(errorParam)
    : undefined;

  const { css } = readMarketingDoc("audit-intake.html");
  const quota = await canUserAudit(authData.user.id);
  const resetDate = new Date(quota.quota_resets_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav active="audit-new" />

      <div className="intake-page">
        <div className="intake-inner">
          <div className="intake-header">
            <div className="intake-header-left">
              <div className="intake-eyebrow">Start a new audit</div>
              <h1 className="intake-title">
                Which business should we <em>audit</em>?
              </h1>
            </div>
            <div className="intake-quota-display">
              <div>
                <span className="intake-quota-display-strong">
                  {quota.monthly_cap - quota.monthly_remaining} of {quota.monthly_cap}
                </span>{" "}
                monthly audits used
              </div>
              <div style={{ marginTop: 4 }}>resets {resetDate}</div>
            </div>
          </div>

          <div className="input-block">
            <div className="input-label">Business identification</div>
            <h2 className="input-headline">
              Three details. We use them to find your <em>exact business</em> on Google.
            </h2>
            <p className="input-sub">
              Verify each field before submitting — the buttons let you confirm your input is correct in a new tab.
            </p>

            <IntakeForm initialError={error} />
          </div>
        </div>
      </div>
    </>
  );
}
