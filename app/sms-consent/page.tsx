import type { Metadata } from "next";
import Link from "next/link";
import {
  SMS_CONSENT_DISCLOSURE_TEXT,
  SMS_CONSENT_FORM_VERSION,
  SMS_CONSENT_SOURCE_PATH,
} from "@/lib/messaging/sms-consent";

export const metadata: Metadata = {
  title: "SMS Consent Form — BAAM Review",
  description:
    "Public SMS opt-in form showing consent language for BAAM Review campaigns.",
};

/**
 * Public, no-login page used to document and demonstrate the exact
 * consent flow language provided to recipients before SMS enrollment.
 */
export default async function SmsConsentPage(props: {
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const { status, reason } = await props.searchParams;
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <main className="min-h-screen bg-cream px-6 py-10 text-text">
      <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-border-base bg-paper p-6 shadow-sm md:p-8">
        <p className="mb-2 text-[12px] uppercase tracking-[0.18em] text-text-muted">
          BAAM Review
        </p>
        <h1 className="mb-3 font-display text-3xl text-ink">SMS Consent Form</h1>
        <p className="mb-6 text-sm leading-6 text-text-soft">
          This public page demonstrates the consent experience used before a user
          can receive BAAM Review SMS messages.
        </p>

        {isSuccess ? (
          <p className="mb-4 rounded-md border border-[#C8E4D5] bg-[#F1FBF6] px-3 py-2 text-sm text-[#1F5D3F]">
            {reason === "submitted_without_sms"
              ? "Form submitted without SMS opt-in. No SMS consent was recorded."
              : "SMS consent submitted and stored successfully."}
          </p>
        ) : null}
        {isError ? (
          <p className="mb-4 rounded-md border border-[#EBCBCB] bg-[#FFF5F5] px-3 py-2 text-sm text-[#8C2F2F]">
            {reason === "invalid_phone"
              ? "Please enter a valid mobile number."
              : "We could not save consent right now. Please try again."}
          </p>
        ) : null}

        <form className="space-y-4" action="/api/sms-consent" method="post">
          <input type="hidden" name="sourcePath" value={SMS_CONSENT_SOURCE_PATH} />
          <input type="hidden" name="formVersion" value={SMS_CONSENT_FORM_VERSION} />
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="businessName">
              Business name
            </label>
            <input
              id="businessName"
              name="businessName"
              type="text"
              className="w-full rounded-md border border-border-base bg-white px-3 py-2 text-sm"
              placeholder="Example Dental NYC"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              className="w-full rounded-md border border-border-base bg-white px-3 py-2 text-sm"
              placeholder="Jane"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mobileNumber">
              Mobile number
            </label>
            <input
              id="mobileNumber"
              name="mobileNumber"
              type="tel"
              required
              className="w-full rounded-md border border-border-base bg-white px-3 py-2 text-sm"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="rounded-lg border border-border-base bg-white p-4">
            <label className="flex items-start gap-3 text-sm leading-6 text-text" htmlFor="smsConsent">
              <input
                id="smsConsent"
                name="smsConsent"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border-base"
              />
              <span>
                {SMS_CONSENT_DISCLOSURE_TEXT.split(" Terms: ")[0]} Terms:{" "}
                <Link href="/legal/terms" className="text-forest underline">
                  https://baamreview.com/legal/terms
                </Link>{" "}
                Privacy:{" "}
                <Link href="/legal/privacy" className="text-forest underline">
                  https://baamreview.com/legal/privacy
                </Link>
                .
              </span>
            </label>
          </div>

          <p className="text-xs leading-5 text-text-muted">
            You may submit this form without agreeing to receive SMS messages.
          </p>

          <button
            type="submit"
            className="inline-flex rounded-md bg-forest px-4 py-2 text-sm font-medium text-white"
          >
            Submit
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-text-muted">
          Questions? Contact{" "}
          <a href="mailto:support@baamplatform.com" className="text-forest underline">
            support@baamplatform.com
          </a>
          .
        </p>
        <p className="mt-2 text-xs text-text-muted">
          <Link href="/" className="text-forest underline">
            Back to homepage
          </Link>
        </p>
      </div>
    </main>
  );
}
