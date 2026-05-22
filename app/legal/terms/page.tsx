import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — BAAM Review",
  description:
    "The terms under which BAAM Review provides its review-collection service to businesses.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="effective">Effective May 22, 2026 · Version 1.0</p>
      <p className="lede">
        These terms govern your use of BAAM Review. By creating an account or
        using the service you agree to them. We tried to keep the lawyering to
        a minimum, but a few sections (warranty, liability, governing law)
        have to be there.
      </p>

      <h2>1. Who you are agreeing with</h2>
      <p>
        BAAM Review is a product of <strong>BAAM Platform Inc.</strong>, a New
        York corporation (&ldquo;BAAM,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
        References to &ldquo;you&rdquo; mean the individual or business entity
        that created the account.
      </p>

      <h2>2. The service</h2>
      <p>
        BAAM Review helps you collect Google reviews from your real customers
        and turn satisfied customers into referrals. The service includes:
      </p>
      <ul>
        <li>
          Sending review-request emails and SMS to recipients you provide.
        </li>
        <li>
          Hosting a public review-collection page at{" "}
          <code>baamreview.com/r/&lt;your-slug&gt;</code> for each of your
          locations.
        </li>
        <li>
          Generating AI-assisted draft text the customer can edit and then post
          to Google themselves.
        </li>
        <li>
          Showing you analytics on opens, clicks, completions, and referrals.
        </li>
        <li>
          On the Full Service plan: our team operates the above on your behalf.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> post reviews on Google for your customers.
        The customer always clicks through to Google and posts the review
        themselves, in their own account. We don&rsquo;t filter or hide
        negative reviews from Google.
      </p>

      <h2>3. Your account</h2>
      <p>
        You must be at least 18 and authorized to bind the business you sign
        up for. Keep your password confidential. You are responsible for
        activity under your account, including activity by staff members you
        invite. Tell us promptly if you suspect unauthorized use.
      </p>
      <p>
        You may invite team members (&ldquo;staff&rdquo;) to your account.
        Each is bound by these terms.
      </p>

      <h2>4. What you can use the service for</h2>
      <p>You agree to:</p>
      <ul>
        <li>
          Only upload contact info for customers who actually used your
          business and who have agreed (or are reasonably expected to expect)
          to receive a review-request message. No purchased lists. No cold
          prospects.
        </li>
        <li>
          Comply with all email (CAN-SPAM, etc.) and SMS (TCPA, 10DLC, etc.)
          laws that apply to you as the sender on record.
        </li>
        <li>
          Comply with Google&rsquo;s Review Content Policy at{" "}
          <a
            href="https://support.google.com/contributionspolicy/answer/7400114"
            target="_blank"
            rel="noopener noreferrer"
          >
            support.google.com/contributionspolicy
          </a>
          . In short: don&rsquo;t offer rewards conditioned on a positive (or
          5-star) review, don&rsquo;t solicit fake reviews, don&rsquo;t review
          your own business.
        </li>
        <li>
          Only set up locations and Google Business Profiles you actually own
          or are authorized to manage.
        </li>
      </ul>

      <h2>5. What you can&rsquo;t use the service for</h2>
      <ul>
        <li>Sending unsolicited bulk messages or anything spam-shaped.</li>
        <li>
          Incentivizing only positive reviews (e.g., &ldquo;leave a 5-star
          review and get $10 off&rdquo;). Incentives may be offered for{" "}
          <em>leaving a review</em>, but not for the rating that review
          contains.
        </li>
        <li>Posting reviews for customers (we don&rsquo;t do this and you can&rsquo;t use the platform to make it look as if customers posted reviews they didn&rsquo;t actually post).</li>
        <li>
          Sending review requests for businesses you don&rsquo;t own or operate
          (third-party review-management without a written authorization from
          the business).
        </li>
        <li>
          Reverse-engineering, scraping our front-end, or copying our
          underlying code or designs.
        </li>
        <li>Anything illegal in the jurisdiction the recipient sits in.</li>
      </ul>
      <p>
        We may suspend or terminate your account immediately for any of the
        above. We&rsquo;ll refund unused prepaid time on a prorated basis
        unless the violation involved fraud.
      </p>

      <h2>6. Pricing &amp; billing</h2>
      <ul>
        <li>
          Subscriptions are <strong>per location</strong>, billed monthly or
          annually. Pricing is at{" "}
          <a href="/pricing">baamreview.com/pricing</a>.
        </li>
        <li>
          Every new location gets a <strong>30-day free trial</strong>. We
          collect a payment method up front so you can be billed without
          interruption when the trial ends, but we don&rsquo;t charge until
          day 31.
        </li>
        <li>
          Billing renews automatically on the same day each month/year until
          you cancel. You can cancel anytime in the admin app; the
          cancellation takes effect at the end of the then-current period.
        </li>
        <li>
          We don&rsquo;t pro-rate unused mid-period time on cancellation. You
          keep access through the period you paid for.
        </li>
        <li>
          Full Service requires <strong>30 days notice</strong> for clean
          handover, but no minimum commitment.
        </li>
        <li>
          We may change prices with at least <strong>60 days notice</strong>{" "}
          to existing customers. If you don&rsquo;t agree, you can cancel
          before the change takes effect and continue at the old price through
          the end of your then-current period. Founding-customer pricing,
          once locked, is locked.
        </li>
        <li>
          Failed payment: we&rsquo;ll retry 3 times over 14 days and email
          you. Persistent failure suspends sending but keeps your data
          intact. After 30 days suspended, we may delete customer recipient
          data per the Privacy Policy.
        </li>
      </ul>

      <h2>7. Your data, your customers&rsquo; data</h2>
      <p>
        You own the customer-recipient data you upload. We process it on your
        behalf as your data processor — see our{" "}
        <a href="/legal/dpa">Data Processing Agreement</a> for the specifics.
        We collect and store the data described in our{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>
      <p>
        You confirm you have a legal basis to send each recipient a review
        request — typically because the recipient is your customer and you
        have a pre-existing business relationship that fits the
        &ldquo;established business relationship&rdquo; exception under CAN-SPAM
        and TCPA. If you&rsquo;re not sure whether a contact qualifies, get
        their explicit consent.
      </p>

      <h2>8. AI-generated drafts</h2>
      <p>
        Our AI-draft feature generates suggested text from the inputs the
        customer provides on the review-collection page. The customer can edit
        or replace the draft before posting. Drafts are <em>suggestions</em>,
        not finished reviews. The author of any posted review is the customer,
        not BAAM Review.
      </p>
      <p>
        We don&rsquo;t guarantee the AI produces error-free, factually accurate,
        or non-offensive text. The customer is the final reviewer.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        We own the BAAM Review software, design, marks, and documentation. We
        grant you a non-exclusive, non-transferable license to use the service
        during your subscription, solely for your business.
      </p>
      <p>
        You own the content you upload (your logo, your branding, your
        customer list, your edits to AI drafts). You grant us a limited
        license to host, transmit, and display that content as required to
        deliver the service. We may use aggregated, de-identified statistics
        (e.g., &ldquo;average completion rate across acupuncture clinics&rdquo;)
        for analytics and marketing.
      </p>

      <h2>10. Google Business Profile</h2>
      <p>
        Connecting your Google Business Profile via OAuth lets us read your
        existing reviews to display them in the admin app and to attribute
        new reviews. We don&rsquo;t modify your profile, can&rsquo;t post on
        your behalf, and store only the tokens needed for read access. You
        can disconnect at any time in the admin app or in your Google account
        permissions.
      </p>

      <h2>11. Service availability</h2>
      <p>
        We target high availability and run on production-grade infrastructure
        but don&rsquo;t offer a numerical uptime SLA at our current pricing.
        We schedule maintenance windows when we need them and try to avoid
        peak hours.
      </p>

      <h2>12. Termination</h2>
      <p>
        <strong>You can cancel any time</strong> in the admin app — your
        access continues until the end of the prepaid period. Your customer
        data is deleted per the Privacy Policy schedule after cancellation.
      </p>
      <p>
        <strong>We can terminate or suspend</strong> your account for breach
        of these terms, non-payment, or actions that put the platform&rsquo;s
        deliverability or compliance posture at risk. We&rsquo;ll give you
        notice and a reasonable opportunity to cure where the breach is
        curable.
      </p>

      <h2>13. Warranty disclaimer</h2>
      <p>
        BAAM Review is provided <strong>&ldquo;as is&rdquo;</strong>. We
        don&rsquo;t guarantee any particular Google ranking, review volume,
        customer response rate, or revenue outcome. Our 10× value framing on
        the marketing site is an aspirational model based on third-party
        research, not a contractual guarantee.
      </p>
      <p>
        To the maximum extent permitted by law, we disclaim all implied
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, neither party will be liable
        for indirect, incidental, consequential, special, or punitive damages
        (lost profits, lost data, business interruption). Each party&rsquo;s
        total liability for direct damages is capped at the fees you paid us
        in the 12 months preceding the claim.
      </p>
      <p>
        This cap does <em>not</em> apply to your indemnification obligations,
        your fee obligations, or either party&rsquo;s breach of
        confidentiality, fraud, or willful misconduct.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You will indemnify and hold BAAM Platform Inc. harmless against
        third-party claims arising from your use of the service in violation
        of these terms or applicable law — including claims by your customers
        that you contacted them without a legal basis to do so.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of the State of New York,
        without regard to conflict-of-laws principles. Disputes go to the
        state and federal courts located in New York County, New York.
      </p>
      <p>
        We don&rsquo;t require arbitration, but either party may agree to
        binding arbitration on a dispute-by-dispute basis if it makes sense.
      </p>

      <h2>17. Changes to these terms</h2>
      <p>
        We&rsquo;ll post material changes here and email business-owner
        accounts at least 30 days before they take effect. If you don&rsquo;t
        agree, cancel before the effective date.
      </p>

      <h2>18. Miscellaneous</h2>
      <ul>
        <li>
          <strong>Severability:</strong> if a court strikes part of these
          terms, the rest remains in force.
        </li>
        <li>
          <strong>No waiver:</strong> we don&rsquo;t waive our rights by not
          enforcing them immediately.
        </li>
        <li>
          <strong>Assignment:</strong> you can&rsquo;t assign these terms
          without our consent. We may assign them to a successor or affiliate.
        </li>
        <li>
          <strong>Entire agreement:</strong> these terms, the Privacy Policy,
          and the DPA make up the entire agreement between us.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        BAAM Platform Inc.<br />
        90 North St, Middletown, NY 10940<br />
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>
      </p>
    </>
  );
}
