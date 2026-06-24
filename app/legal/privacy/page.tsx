import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BAAM Review",
  description:
    "How BAAM Review collects, uses, and protects personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="effective">Last updated: 2025-11-13</p>
      <p className="lede">
        Baam Platform is a product of <strong>Harmonia Strategy Inc.</strong>.
        This Privacy Policy explains how we collect, use, disclose, and protect
        information when you use BAAM services.
      </p>
      <p>
        It is designed to align with Google OAuth/API verification requirements
        and the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        .
      </p>
      <p>
        <strong>Contact Information:</strong>
        <br />
        Baam Platform
        <br />
        28 Pine St, Middletown, NY 10940, USA
        <br />
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>
      </p>

      <h2>1. Scope</h2>
      <p>This Policy applies to information we collect about:</p>
      <ul>
        <li>Visitors to our public websites and landing pages.</li>
        <li>
          Customers and end users who create accounts or use our Services.
        </li>
        <li>Users who authorize integrations (e.g., Google OAuth/GBP).</li>
      </ul>
      <p>
        If you are an end user of a Client using our Services, we process data
        on behalf of that Client as a processor/service provider.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect information in four ways:</p>

      <h3>A) Information You Provide</h3>
      <ul>
        <li>
          <strong>Account &amp; Profile Data:</strong> name, email, company,
          role/title, phone number, profile photo, and preferences.
        </li>
        <li>
          <strong>Business Content:</strong> website copy/media, brand assets,
          business profile details, and related configured/uploaded content.
        </li>
        <li>
          <strong>Support &amp; Communications:</strong> messages, feedback,
          survey responses, and information you provide to our team.
        </li>
      </ul>

      <h3>B) Information from Your Use of the Services</h3>
      <ul>
        <li>
          <strong>Usage &amp; Device Data:</strong> IP, device identifiers,
          browser type/version, operating system, pages viewed, timestamps, and
          diagnostics/performance data.
        </li>
        <li>
          <strong>Cookies &amp; Similar Technologies:</strong> cookies and
          similar technologies to maintain sessions, remember settings, analyze
          usage, and improve services.
        </li>
      </ul>

      <h3>C) Information from Third Parties (including Google APIs)</h3>
      <p>
        If you connect third-party services, we may receive information allowed
        by your settings with those services.
      </p>
      <ul>
        <li>
          <strong>Google OAuth / Google Business Profile:</strong> with your
          consent, we may request scopes like <code>openid</code>,{" "}
          <code>email</code>, <code>profile</code>, and{" "}
          <code>https://www.googleapis.com/auth/business.manage</code> to
          provide requested features.
        </li>
      </ul>
      <p>
        You can review or revoke access at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h3>D) SMS Messaging Data</h3>
      <ul>
        <li>
          <strong>Phone &amp; Consent Records:</strong> mobile number, consent
          source, status, timestamps, and related audit metadata.
        </li>
        <li>
          <strong>Message Data:</strong> message content/templates, send timing,
          sender identity, and destination metadata for routing.
        </li>
        <li>
          <strong>Delivery &amp; Interaction Data:</strong> carrier delivery
          events and keyword replies such as STOP/HELP.
        </li>
        <li>
          <strong>Suppression Data:</strong> opt-out and suppression records
          used to prevent future messaging after unsubscribe.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>Provide, operate, maintain, and improve Services.</li>
        <li>Authenticate users, secure accounts, and prevent abuse/fraud.</li>
        <li>Perform integrations you explicitly authorize.</li>
        <li>
          Send service-related communications and, where allowed, marketing
          communications.
        </li>
        <li>
          Handle SMS delivery/compliance, including opt-out/help processing.
        </li>
        <li>Meet legal obligations and enforce agreements.</li>
      </ul>
      <p>
        <strong>Legal Bases (EEA/UK):</strong> where applicable, processing is
        based on contract performance, legitimate interests, legal obligations,
        and/or consent.
      </p>

      <h2>4. Our Commitment to Google API Data Policy (Limited Use)</h2>
      <ul>
        <li>
          We use Google user data only for requested user-facing features.
        </li>
        <li>
          We do not sell Google user data.
        </li>
        <li>
          We do not use Google data for ads or targeted marketing profiles.
        </li>
        <li>
          We allow human access only when permitted by policy (consent,
          security/legal, or approved internal operations).
        </li>
      </ul>

      <h3>4A. YouTube API Services (Addendum)</h3>
      <p>
        This application uses YouTube API Services. By using Baam YouTube
        features, you agree to{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>{" "}
        and{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>
        .
      </p>
      <ul>
        <li>We store OAuth tokens and minimum identifiers needed for features.</li>
        <li>
          We do not store YouTube video binaries and do not use YouTube data
          for advertising.
        </li>
        <li>
          Access occurs for user-initiated actions; no background polling.
        </li>
        <li>
          You can revoke access in Google account permissions or disconnect
          inside Baam.
        </li>
      </ul>

      <h2>5. Data Sharing &amp; International Transfers</h2>
      <p>We do not sell personal information. We may share data only with:</p>
      <ul>
        <li>
          Service providers/processors (e.g., hosting, analytics, Twilio,
          Resend) under contractual protections.
        </li>
        <li>
          Legal/compliance recipients when required by law or to protect rights
          and safety.
        </li>
        <li>
          Third parties you explicitly direct us to integrate with or share to.
        </li>
      </ul>
      <p>
        International transfers are made under appropriate safeguards (e.g.,
        Standard Contractual Clauses).
      </p>

      <h2>6. Data Retention &amp; Deletion</h2>
      <ul>
        <li>Data is retained only as long as needed for stated purposes/law.</li>
        <li>
          OAuth tokens are retained only while integrations are active and
          needed.
        </li>
        <li>
          You can request deletion or anonymization via account settings (if
          available) or{" "}
          <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>.
        </li>
      </ul>

      <h2>6A. SMS Program Disclosures (US)</h2>
      <ul>
        <li>Message frequency varies.</li>
        <li>Message and data rates may apply.</li>
        <li>Consent is not a condition of purchase.</li>
        <li>
          Opt out by replying <code>STOP</code>, <code>UNSUBSCRIBE</code>,{" "}
          <code>CANCEL</code>, <code>END</code>, or <code>QUIT</code>.
        </li>
        <li>
          For help, reply <code>HELP</code> or contact{" "}
          <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>.
        </li>
        <li>
          After opt-out, one final confirmation may be sent; then no further
          non-required SMS will be sent.
        </li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
      </ul>

      <h2>Data Deletion and Revocation</h2>
      <ul>
        <li>
          Disconnect Google in dashboard to immediately stop access and
          invalidate tokens.
        </li>
        <li>
          Google-sourced cached data is deleted or anonymized within 30 days
          after disconnect/revocation unless legally required otherwise.
        </li>
        <li>
          Full account deletion requests can be sent to{" "}
          <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>.
        </li>
      </ul>

      <h2>7. Your Rights &amp; Choices</h2>
      <ul>
        <li>Access, correction, deletion, restriction, objection, portability.</li>
        <li>Withdraw consent where processing relies on consent.</li>
        <li>Lodge complaints with supervisory/regulatory authorities.</li>
      </ul>
      <p>
        To exercise rights, contact{" "}
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>.
      </p>

      <h2>8. Security</h2>
      <p>
        We use administrative, technical, and organizational safeguards,
        including encryption in transit/at rest and access controls.
      </p>

      <h2>9. Children’s Privacy</h2>
      <p>
        Services are not directed to children under 13 (or minimum age under
        local law). If a child’s data is submitted, contact us for deletion.
      </p>

      <h2>10. Third-Party Links</h2>
      <p>
        Services may include links to third-party websites/services. We are not
        responsible for their privacy practices.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time and will update the "Last
        updated" date.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        BaaM Platform
        <br />
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>
        <br />
        28 Pine St, Middletown, NY 10940, USA
      </p>
      <p>
        SMS Help: Reply <code>HELP</code> to any BAAM message or email{" "}
        <a href="mailto:support@baamplatform.com">support@baamplatform.com</a>.
      </p>
    </>
  );
}
