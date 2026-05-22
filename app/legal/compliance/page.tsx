import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compliance — BAAM Review",
  description:
    "How BAAM Review complies with TCPA, CAN-SPAM, Google's Review Content Policy, CCPA, GDPR, and other regulations.",
};

export default function CompliancePage() {
  return (
    <>
      <h1>Compliance</h1>
      <p className="effective">Effective May 22, 2026 · Version 1.0</p>
      <p className="lede">
        This page maps how BAAM Review handles the regulations that matter for
        a US-focused review-collection platform — what we do, what you
        (the business owner) need to do, and what we don&rsquo;t do. If you
        have a specific compliance question we haven&rsquo;t covered, email{" "}
        <a href="mailto:privacy@baamplatform.com">
          privacy@baamplatform.com
        </a>{" "}
        and we&rsquo;ll add it here.
      </p>

      <h2>Google Review Content Policy</h2>
      <p>
        Google has clear rules about how reviews can be solicited. BAAM
        Review&rsquo;s entire workflow is built around them:
      </p>
      <ul>
        <li>
          <strong>Authentic reviews only.</strong> Every review on the
          platform is written and posted by the actual customer in their own
          Google account. We don&rsquo;t post on anyone&rsquo;s behalf.
        </li>
        <li>
          <strong>No filtering of negative reviews.</strong> We don&rsquo;t
          have, and have never had, the ability to hide a negative review
          from Google. The customer always clicks through to Google to post.
          What you <em>can</em> do is route low-rating customers to private
          feedback first (so they can vent to you instead of in public), but
          we never intercept a review that&rsquo;s on its way to Google.
        </li>
        <li>
          <strong>No conditional incentives.</strong> The platform allows you
          to offer an incentive for <em>leaving a review</em> (any rating).
          It does not let you condition the incentive on a positive or
          5-star review.
        </li>
        <li>
          <strong>No self-reviews.</strong> Owner and staff accounts on a
          location are flagged; the review-invitation system blocks them
          from being added as recipients.
        </li>
        <li>
          <strong>AI drafts are clearly drafts.</strong> The customer always
          sees and can edit (or replace) the AI-generated text before
          posting. The customer is the author.
        </li>
      </ul>
      <p>
        Read the policy at{" "}
        <a
          href="https://support.google.com/contributionspolicy/answer/7400114"
          target="_blank"
          rel="noopener noreferrer"
        >
          support.google.com/contributionspolicy/answer/7400114
        </a>
        .
      </p>

      <h2>Email — CAN-SPAM Act (US)</h2>
      <p>
        Every email BAAM Review sends on your behalf carries:
      </p>
      <ul>
        <li>
          A clear sender identification with the business name and a real
          physical address.
        </li>
        <li>An accurate, non-deceptive subject line.</li>
        <li>
          A working unsubscribe link processed within 10 business days (we
          process them within minutes).
        </li>
        <li>
          An indication of the email&rsquo;s commercial nature where
          required.
        </li>
      </ul>
      <p>
        Your obligation: only upload contacts that have an &ldquo;established
        business relationship&rdquo; with you (current or recent customers).
        Don&rsquo;t upload purchased lists.
      </p>

      <h2>SMS — TCPA &amp; 10DLC (US)</h2>
      <p>
        SMS rules are stricter than email. BAAM Review handles the
        platform-side mechanics:
      </p>
      <ul>
        <li>
          We register the sending phone numbers under 10DLC and route through
          a registered campaign with the appropriate use-case (Customer Care
          /  Two-Factor / Marketing as applicable to your sending pattern).
        </li>
        <li>
          Every SMS includes a clear sender identifier and references your
          business name.
        </li>
        <li>
          We process <code>STOP</code> / <code>UNSUBSCRIBE</code> /{" "}
          <code>QUIT</code> / <code>CANCEL</code> / <code>END</code> within
          seconds, send the required confirmation, and never re-send to a
          number that opted out — even if you re-upload it.
        </li>
        <li>
          We process <code>HELP</code> with a response that identifies the
          sender and offers contact info.
        </li>
        <li>
          We respect quiet hours (8 am – 9 pm in the recipient&rsquo;s local
          time zone, derived from area code).
        </li>
      </ul>
      <p>
        Your obligation: only message recipients who have given express
        consent (TCPA written-consent standard for marketing messages, or
        established-business-relationship for transactional ones). Document
        consent — Twilio may ask for proof during campaign approval. Don&rsquo;t
        use SMS for prospecting.
      </p>

      <h2>CCPA &amp; CPRA — California</h2>
      <p>
        California residents have the right to:
      </p>
      <ul>
        <li>
          <strong>Know</strong> what personal info we hold about them.
        </li>
        <li>
          <strong>Delete</strong> personal info we hold (subject to legal
          retention requirements).
        </li>
        <li>
          <strong>Correct</strong> inaccurate personal info.
        </li>
        <li>
          <strong>Opt out of &ldquo;sale&rdquo; or &ldquo;sharing&rdquo;</strong>{" "}
          of personal info. BAAM Review does not sell or share personal info
          as those terms are defined under CCPA/CPRA. There&rsquo;s nothing to
          opt out of, but we honor the request anyway.
        </li>
        <li>
          <strong>Limit use of sensitive personal info.</strong> We don&rsquo;t
          process sensitive PI (race, religion, health, biometrics, government
          IDs, precise geolocation).
        </li>
        <li>
          <strong>Non-discrimination</strong> for exercising any of the above.
        </li>
      </ul>
      <p>
        To exercise any of these rights as a California resident, email{" "}
        <a href="mailto:privacy@baamplatform.com">
          privacy@baamplatform.com
        </a>{" "}
        with &ldquo;CCPA request&rdquo; in the subject. We respond within 45
        days. If you&rsquo;re an authorized agent acting for someone else,
        include verification.
      </p>

      <h2>GDPR &amp; UK GDPR — EU / UK</h2>
      <p>
        BAAM Review is not marketed in the EU or UK; our infrastructure is in
        the United States. If you signed up while located in the EU or UK,
        you have the rights of access, rectification, erasure, restriction,
        data portability, and objection. The legal basis for processing is
        contractual necessity (operating the service you bought) and our
        legitimate interest in security, fraud prevention, and improving the
        product.
      </p>
      <p>
        Cross-border transfers are covered by Standard Contractual Clauses
        — see §8 of the <a href="/legal/dpa">DPA</a>.
      </p>

      <h2>HIPAA — healthcare data</h2>
      <p>
        BAAM Review is not a HIPAA Business Associate and does not sign
        Business Associate Agreements at the current pricing tier. If you
        operate a medical practice, you can use BAAM Review to send
        review-request messages provided you don&rsquo;t include Protected
        Health Information (PHI) in the customer record — name + contact info
        + appointment-date is permissible under the &ldquo;limited data set&rdquo;
        exception, but specific diagnoses, treatment details, or insurance
        info are not.
      </p>
      <p>
        We&rsquo;re evaluating a HIPAA-compliant infrastructure path (AWS +
        signed BAAs with sub-processors) for a future pricing tier. If this
        matters to you, email{" "}
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>{" "}
        and we&rsquo;ll add you to the wait-list.
      </p>

      <h2>Accessibility (ADA / WCAG)</h2>
      <p>
        We target WCAG 2.1 AA compliance for the customer-facing review-
        collection page (the page your customers see). Specifics:
      </p>
      <ul>
        <li>Color contrast ratios meet AA on all text + interactive elements.</li>
        <li>All form fields have proper labels; radio groups have fieldset/legend.</li>
        <li>Page works with keyboard navigation; focus rings are visible.</li>
        <li>The page is responsive down to 320px wide and supports text reflow at 200% zoom.</li>
        <li>Language is declared via the <code>lang</code> attribute so screen readers pronounce correctly.</li>
      </ul>
      <p>
        The admin app at <code>review.baamplatform.com</code> is held to the
        same standard with one exception: complex data tables in analytics
        sections may not be fully optimized for screen-reader navigation.
        We&rsquo;re working on it.
      </p>

      <h2>Section 230 — third-party content</h2>
      <p>
        Reviews are user-generated content posted to Google. Once posted,
        they live in Google&rsquo;s system, not ours. We&rsquo;re a passive
        platform between you and Google — not the publisher of the review
        text — and rely on the protections of Section 230 of the
        Communications Decency Act for that posture.
      </p>

      <h2>Security &amp; SOC 2</h2>
      <p>
        BAAM Platform Inc. is not currently SOC 2 certified. Our sub-processors
        (Supabase, Vercel, Stripe, Resend, Twilio, Anthropic) are all SOC 2
        Type II certified or equivalent, and the data they touch is encrypted
        in transit and at rest. We follow the security measures described
        in §7 of the <a href="/legal/dpa">DPA</a>.
      </p>
      <p>
        SOC 2 Type II certification is on our roadmap for the year after we
        reach 500 paying business accounts. Email us if your buying process
        requires it sooner — we can sometimes accelerate or provide
        equivalent assurance.
      </p>

      <h2>Children — COPPA</h2>
      <p>
        BAAM Review is not directed at children under 13 and we don&rsquo;t
        knowingly collect data from anyone in that age range. If you operate
        a business that serves families, never upload a child as the customer
        contact — upload the parent or guardian.
      </p>

      <h2>Anti-spam DKIM / SPF / DMARC</h2>
      <p>
        Email deliverability is a compliance issue too — landing in spam
        wastes the recipient&rsquo;s attention as much as it wastes your
        money. We:
      </p>
      <ul>
        <li>
          Send through Resend with proper SPF, DKIM (selector-rotation), and
          DMARC policies on <code>baamplatform.com</code>.
        </li>
        <li>
          Offer per-location custom sending domains (sender verified through
          Resend) for accounts that want emails to land in Primary instead of
          Promotions.
        </li>
        <li>
          Monitor bounce rates and automatically suppress addresses that
          bounce hard or generate complaints.
        </li>
        <li>
          Honor list-unsubscribe headers for one-click unsubscribe in Gmail
          and Outlook.
        </li>
      </ul>

      <h2>Reporting a concern</h2>
      <p>
        If you believe BAAM Review or a business using it has violated the
        above, email{" "}
        <a href="mailto:compliance@baamplatform.com">
          compliance@baamplatform.com
        </a>
        . We investigate within 7 business days. For urgent matters
        (impersonation, abuse, security), label the subject line{" "}
        <code>URGENT</code>.
      </p>

      <h2>Updates</h2>
      <p>
        We&rsquo;ll add new sections here as the platform grows into new
        regulatory territory (HIPAA BAA, SOC 2, additional state privacy
        laws). Material changes are emailed to business-owner accounts at
        least 30 days before they take effect.
      </p>
    </>
  );
}
