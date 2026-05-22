import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BAAM Review",
  description:
    "What BAAM Review collects, how we use it, who we share it with, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="effective">Effective May 22, 2026 · Version 1.0</p>
      <p className="lede">
        This policy explains what BAAM Review collects, how we use it, who we
        share it with, how long we keep it, and how you can get a copy or have
        it deleted. We tried to write it plainly. Where a section uses a legal
        term, we explain what it actually means.
      </p>

      <h2>Who this policy covers</h2>
      <p>
        BAAM Review (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is operated by BAAM
        Platform Inc., a New York corporation. This policy covers our website
        at <code>baamreview.com</code>, the application at{" "}
        <code>review.baamplatform.com</code>, and any review-collection page we
        host at <code>baamreview.com/r/&lt;slug&gt;</code> on behalf of a
        business.
      </p>
      <p>
        We use the term <strong>business owner</strong> to mean the person who
        signs up for a BAAM Review account, and <strong>reviewer</strong> (or{" "}
        <strong>customer</strong>) to mean the end customer the business owner
        is asking to leave a review.
      </p>

      <h2>What we collect</h2>

      <h3>From business owners (the signed-up account)</h3>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, password hash, account
          role (owner / admin / staff).
        </li>
        <li>
          <strong>Business profile data:</strong> business name, address,
          website, social-media handles, brand color, logo image, your Google
          Business Profile ID (after you authorize the connection).
        </li>
        <li>
          <strong>Billing data:</strong> subscription tier, billing interval,
          current period end. Credit-card numbers are stored only by Stripe and
          never touch our servers; we store a Stripe customer ID.
        </li>
        <li>
          <strong>Usage logs:</strong> IP, user agent, the pages you visit
          inside the admin app, the actions you take (send invitation, reply to
          a review, etc.). We use these for operations, billing accuracy, and
          troubleshooting.
        </li>
      </ul>

      <h3>From customers (the people the business asks to review)</h3>
      <ul>
        <li>
          <strong>Contact info that the business uploads to us:</strong> name,
          email, phone number, optional notes the business added. The business
          owner is the source — we don&rsquo;t buy lists.
        </li>
        <li>
          <strong>Review-flow inputs:</strong> when the customer opens the
          review link, we record which services they tapped, what star rating
          they picked, the descriptor word, any free-text note they typed, and
          (if AI assist is used) the prompt text and the draft we generated.
        </li>
        <li>
          <strong>Outcome:</strong> whether the customer went to Google, left
          private feedback, or left the page. We do <em>not</em> see the
          customer&rsquo;s Google account; Google handles posting and shows the
          review publicly.
        </li>
        <li>
          <strong>Tracking-link metadata:</strong> when the customer opens the
          email or SMS, clicks the link, opens the share-card page, or shares
          it onward. We tag this to the original invitation so we can show the
          business what worked.
        </li>
      </ul>

      <h3>From visitors to baamreview.com</h3>
      <ul>
        <li>
          Standard server logs (IP, user agent, requested path, referer). We
          retain these for 90 days for security and abuse detection.
        </li>
        <li>
          A handful of strictly-necessary cookies for the admin app session.
          We don&rsquo;t use third-party advertising cookies or run a tracking
          pixel on the marketing site.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>
          <strong>Run the service:</strong> send invitations, generate AI
          drafts, deliver share-cards, attribute referrals, render dashboards.
        </li>
        <li>
          <strong>Billing:</strong> charge subscriptions and produce receipts.
        </li>
        <li>
          <strong>Operations:</strong> monitor for abuse, prevent fraud,
          troubleshoot bugs.
        </li>
        <li>
          <strong>Improve the product:</strong> aggregated analytics about
          which features get used. AI draft prompts and completions may be used
          (in de-identified form) to improve drafting quality for the user&rsquo;s
          own account.
        </li>
        <li>
          <strong>Required communication:</strong> account confirmations,
          billing receipts, service-incident notices. These go to the business
          owner&rsquo;s email and are not optional while you have an account.
          Marketing emails are separate and unsubscribable in one click.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> sell customer data. We do <strong>not</strong>
        use customer review-flow inputs to train any model outside of the
        AI-draft generation for that customer&rsquo;s own session.
      </p>

      <h2>Sub-processors (who else touches the data)</h2>
      <p>
        BAAM Review is a thin layer over best-in-class infrastructure. The
        vendors below are the only third parties that receive your data, and
        only for the narrow purpose listed:
      </p>
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Purpose</th>
            <th>Data they see</th>
            <th>Where (region)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Database & file storage</td>
            <td>Everything above except payment cards</td>
            <td>US (AWS us-east)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>App hosting</td>
            <td>Server logs + request metadata</td>
            <td>US (multi-region)</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Transactional email</td>
            <td>Recipient name, email, message body</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Twilio</td>
            <td>Transactional SMS</td>
            <td>Recipient name, phone, message body</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Billing &amp; payment processing</td>
            <td>Business owner contact + payment card</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Anthropic</td>
            <td>AI draft generation</td>
            <td>The review-flow inputs (de-identified)</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Google (Business Profile API)</td>
            <td>Authorized read of your reviews</td>
            <td>Tokens scoped to your GBP</td>
            <td>US</td>
          </tr>
        </tbody>
      </table>
      <p>
        We publish updates to this list on the Compliance page, and notify
        business-owner accounts by email at least 30 days before adding a new
        sub-processor that touches customer data.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>
          <strong>Active account data:</strong> kept for as long as the account
          exists.
        </li>
        <li>
          <strong>Customer recipient data:</strong> kept for 18 months from the
          invitation date, then deleted from operational systems and retained
          only in encrypted backups for an additional 30 days before final
          deletion.
        </li>
        <li>
          <strong>Server logs:</strong> 90 days.
        </li>
        <li>
          <strong>Billing records:</strong> 7 years (US tax-record requirement).
        </li>
      </ul>
      <p>
        On account cancellation, we delete all customer recipient data within
        30 days. Account data, business-profile data, and billing records are
        retained per the schedule above. You can request earlier deletion of
        any data not subject to a legal retention requirement.
      </p>

      <h2>Your rights</h2>
      <p>
        Regardless of where you live, you can ask us to:
      </p>
      <ul>
        <li>Send you a copy of your data in a portable format (JSON or CSV).</li>
        <li>Correct anything that is wrong.</li>
        <li>Delete data we don&rsquo;t need for a legal/operational reason.</li>
        <li>Stop using your data for any specific purpose we use it for.</li>
      </ul>
      <p>
        Email{" "}
        <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>{" "}
        with your account email. We&rsquo;ll respond within 30 days and almost
        always within 7.
      </p>
      <p>
        <strong>California residents</strong> have the additional CCPA / CPRA
        rights described on our Compliance page. <strong>EU/UK residents:</strong>{" "}
        we don&rsquo;t market into the EU/UK, but if you signed up anyway you
        have the GDPR / UK GDPR rights described there too.
      </p>

      <h2>Customers who want to opt out</h2>
      <p>
        If you received an email or SMS from BAAM Review because a business
        added you to their list:
      </p>
      <ul>
        <li>
          <strong>Email:</strong> click the unsubscribe link at the bottom of
          any message, or email{" "}
          <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>.
          Unsubscribing removes you from <em>that</em> business&rsquo;s list
          and the BAAM Review system. The business cannot re-add you without
          your consent.
        </li>
        <li>
          <strong>SMS:</strong> reply <code>STOP</code> to any message. Per the
          US TCPA, this stops messages from that sender within 24 hours.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        BAAM Review is not directed to children under 13. We don&rsquo;t
        knowingly collect data from children. If you believe a child&rsquo;s
        data has been submitted to us, email{" "}
        <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>{" "}
        and we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        All data is encrypted in transit (TLS 1.2+) and at rest (AES-256). Our
        admin app enforces 2-factor authentication for staff with database
        access. Production database backups are encrypted and stored in a
        separate region. We use row-level security on all customer-facing
        tables. We monitor access via audit logs and alert on anomalies.
      </p>
      <p>
        Despite this, no system is perfectly secure. We&rsquo;ll notify any
        affected business owner via email within 72 hours of confirming a
        breach that involved their data.
      </p>

      <h2>International transfers</h2>
      <p>
        Our infrastructure is in the United States. If you access BAAM Review
        from outside the US, your data crosses to the US. For EU/UK customers,
        we rely on Standard Contractual Clauses; ask us for the executed copy.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We&rsquo;ll post any material change here and email business-owner
        accounts at least 30 days before it takes effect. Minor wording
        clarifications get posted without notice. The &ldquo;Version&rdquo;
        line at the top tracks every revision.
      </p>

      <h2>How to contact us</h2>
      <p>
        BAAM Platform Inc.<br />
        90 North St, Middletown, NY 10940<br />
        <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>
      </p>
    </>
  );
}
