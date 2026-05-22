import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement — BAAM Review",
  description:
    "How BAAM Review processes customer data on behalf of business customers, our security measures, sub-processors, and data-subject rights.",
};

export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Agreement</h1>
      <p className="effective">Effective May 22, 2026 · Version 1.0</p>
      <p className="lede">
        This DPA describes how BAAM Review processes personal data on behalf of
        the business that signed up (the &ldquo;Controller&rdquo;). It is
        incorporated by reference into the <a href="/legal/terms">Terms of
        Service</a> and applies automatically — you don&rsquo;t need to sign a
        separate document. If your legal team needs a counter-signed version,
        email{" "}
        <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>.
      </p>

      <h2>1. Definitions</h2>
      <p>
        Capitalized terms not defined here have the meaning given in the
        applicable data-protection law (GDPR Art. 4, CCPA §1798.140, or
        equivalent).
      </p>
      <ul>
        <li>
          <strong>Controller:</strong> the business account holder. The
          Controller decides why and how Customer Data is processed.
        </li>
        <li>
          <strong>Processor:</strong> BAAM Platform Inc. We process Customer
          Data only on the Controller&rsquo;s documented instructions.
        </li>
        <li>
          <strong>Customer Data:</strong> personal data the Controller uploads
          to or generates through BAAM Review concerning its own customers
          (the Data Subjects).
        </li>
        <li>
          <strong>Data Subject:</strong> the end customer who receives the
          review-request, opens the review page, or interacts with the share
          card.
        </li>
        <li>
          <strong>Sub-processor:</strong> a third party engaged by us to
          process Customer Data.
        </li>
      </ul>

      <h2>2. Roles</h2>
      <p>
        With respect to Customer Data, the Controller is the controller and
        BAAM is the processor. With respect to account-administration data
        (your name, email, billing info), BAAM is the controller — see the{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>

      <h2>3. Scope, purpose, and duration</h2>
      <p>
        We process Customer Data only to provide the BAAM Review service:
        sending invitations, hosting the review-collection page, generating
        AI-assisted drafts, tracking outcomes, and reporting to the
        Controller. We process it for the duration of the Controller&rsquo;s
        subscription plus the retention window described in §10.
      </p>

      <h2>4. Categories of data and Data Subjects</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
            <th>Data Subjects</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Identification</td>
            <td>Name, email, phone, postal address (optional)</td>
            <td>The Controller&rsquo;s customers</td>
          </tr>
          <tr>
            <td>Communication metadata</td>
            <td>Open, click, bounce timestamps; user agent</td>
            <td>The Controller&rsquo;s customers</td>
          </tr>
          <tr>
            <td>Review-flow inputs</td>
            <td>Services selected, star rating, descriptor, free-text note</td>
            <td>The Controller&rsquo;s customers</td>
          </tr>
          <tr>
            <td>AI prompt / completion</td>
            <td>The text the Data Subject provided + draft generated</td>
            <td>The Controller&rsquo;s customers</td>
          </tr>
          <tr>
            <td>Referral attribution</td>
            <td>Share-card token, source destination, conversion event</td>
            <td>
              The Controller&rsquo;s customers and recipients of share cards
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        We do <strong>not</strong> process special-category personal data
        (race, religion, health, etc.) or government IDs. The Controller
        agrees not to upload such data through BAAM Review.
      </p>

      <h2>5. Processor obligations</h2>
      <p>BAAM will:</p>
      <ul>
        <li>Process Customer Data only on the Controller&rsquo;s documented instructions (these terms + the Controller&rsquo;s configured settings).</li>
        <li>Ensure that personnel authorized to process Customer Data are bound by confidentiality.</li>
        <li>Implement the technical and organizational measures listed in §7.</li>
        <li>Assist the Controller in responding to Data Subject Requests (§9).</li>
        <li>Notify the Controller without undue delay (and in any event within 72 hours of becoming aware) of any Personal Data Breach affecting Customer Data.</li>
        <li>Delete or return Customer Data at the end of the engagement, per §10.</li>
        <li>Make available to the Controller the information needed to demonstrate compliance, and allow for audits, per §11.</li>
      </ul>

      <h2>6. Sub-processors</h2>
      <p>
        The Controller authorizes BAAM to engage the following sub-processors:
      </p>
      <table>
        <thead>
          <tr>
            <th>Sub-processor</th>
            <th>Function</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase, Inc.</td>
            <td>Database, file storage, authentication</td>
            <td>United States (AWS us-east)</td>
          </tr>
          <tr>
            <td>Vercel Inc.</td>
            <td>Application hosting and edge delivery</td>
            <td>United States (multi-region)</td>
          </tr>
          <tr>
            <td>Resend, Inc.</td>
            <td>Transactional email delivery</td>
            <td>United States</td>
          </tr>
          <tr>
            <td>Twilio Inc.</td>
            <td>Transactional SMS delivery</td>
            <td>United States</td>
          </tr>
          <tr>
            <td>Stripe, Inc.</td>
            <td>Payment processing for subscription billing</td>
            <td>United States</td>
          </tr>
          <tr>
            <td>Anthropic PBC</td>
            <td>AI-draft text generation</td>
            <td>United States</td>
          </tr>
          <tr>
            <td>Google LLC</td>
            <td>Business Profile API (read-only with OAuth scope)</td>
            <td>United States</td>
          </tr>
        </tbody>
      </table>
      <p>
        We may engage a new sub-processor with at least <strong>30 days
        notice</strong> emailed to the Controller&rsquo;s account email. If
        the Controller objects on reasonable data-protection grounds, the
        Controller may terminate the subscription and receive a pro-rata
        refund of unused prepaid fees.
      </p>
      <p>
        We remain liable for the acts and omissions of our sub-processors
        with respect to Customer Data.
      </p>

      <h2>7. Security measures</h2>
      <p>
        BAAM maintains technical and organizational measures appropriate to
        the risk, including:
      </p>
      <ul>
        <li>
          <strong>Encryption:</strong> TLS 1.2+ in transit; AES-256 at rest
          (database, file storage, backups).
        </li>
        <li>
          <strong>Access control:</strong> least-privilege admin roles; 2FA
          enforced for any staff with database access; row-level security
          policies on customer-facing tables.
        </li>
        <li>
          <strong>Audit logging:</strong> authentication, admin actions, and
          export operations are logged centrally.
        </li>
        <li>
          <strong>Backups:</strong> daily encrypted backups stored in a
          separate region; tested quarterly.
        </li>
        <li>
          <strong>Secrets management:</strong> credentials stored in a managed
          secrets store, rotated on personnel change.
        </li>
        <li>
          <strong>Vendor security:</strong> all sub-processors are SOC 2 Type
          II certified or equivalent; we review their compliance reports
          annually.
        </li>
        <li>
          <strong>Vulnerability management:</strong> dependency scanning on
          every deploy; security patches applied within 7 days of high-severity
          advisories.
        </li>
      </ul>

      <h2>8. International data transfers</h2>
      <p>
        Customer Data is processed in the United States. For Data Subjects
        located in the EEA, UK, or Switzerland, the transfer is covered by
        the European Commission&rsquo;s Standard Contractual Clauses (SCCs)
        Module Two (controller-to-processor). The SCCs are incorporated by
        reference; ask for an executed copy. For UK Data Subjects, the
        International Data Transfer Addendum to the EU SCCs applies.
      </p>

      <h2>9. Data Subject requests</h2>
      <p>
        If a Data Subject contacts BAAM directly, we refer them to the
        Controller. If a Data Subject contacts the Controller (e.g., asks to
        be deleted from a list), the Controller can fulfill the request
        through the admin app — opening a customer&rsquo;s record exposes
        Delete and Export buttons. If the Controller needs help, email{" "}
        <a href="mailto:privacy@baamplatform.com">
          privacy@baamplatform.com
        </a>{" "}
        and we&rsquo;ll respond within 7 days.
      </p>

      <h2>10. Return or deletion of data</h2>
      <p>
        On termination of the engagement, the Controller may within 30 days
        export Customer Data via the admin app or by request. After that
        window:
      </p>
      <ul>
        <li>
          Customer Data is deleted from active production systems within{" "}
          <strong>30 days</strong>.
        </li>
        <li>
          Encrypted backups containing Customer Data are retained for an
          additional <strong>30 days</strong> and then permanently deleted in
          the next backup-rotation cycle.
        </li>
        <li>
          Aggregated, de-identified statistics may be retained indefinitely
          provided they cannot be re-identified.
        </li>
      </ul>

      <h2>11. Audits</h2>
      <p>
        BAAM makes the following available to the Controller on reasonable
        written request:
      </p>
      <ul>
        <li>This DPA and Privacy Policy.</li>
        <li>The current sub-processor list (§6).</li>
        <li>
          Sub-processor SOC 2 / ISO 27001 reports we receive from our
          vendors (under NDA).
        </li>
        <li>
          A summary of our annual security review, including penetration-test
          remediation status.
        </li>
      </ul>
      <p>
        On-site audits are not standard at BAAM Review&rsquo;s current scale.
        For Controllers with regulated data-protection audit requirements
        (e.g., financial-services or healthcare buyers), we can arrange a
        remote-audit session and answer a security questionnaire.
      </p>

      <h2>12. Liability</h2>
      <p>
        The liability cap and exclusions in §14 of the{" "}
        <a href="/legal/terms">Terms of Service</a> apply to this DPA.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update this DPA to reflect changes in law, technology, or our
        sub-processor list. Material changes are notified at least 30 days
        before they take effect; the version line at the top tracks every
        revision.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about this DPA, security, or sub-processors:<br />
        <a href="mailto:privacy@baamplatform.com">privacy@baamplatform.com</a>
      </p>
    </>
  );
}
