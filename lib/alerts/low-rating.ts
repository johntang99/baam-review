import "server-only";
import { sendEmailViaResend } from "@/lib/messaging/resend";

interface LowRatingAlertOpts {
  to: string;
  locationName: string;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  reviewCreateTime: string;
  appUrl: string;
  locationId: string;
}

/**
 * Send a 1-2 star "Heads up" email to the account's primary email when a
 * low-rating review is discovered during sync. Best-effort — failure logs
 * but doesn't break the sync.
 */
export async function sendLowRatingAlert(opts: LowRatingAlertOpts): Promise<void> {
  const reviewer = opts.reviewerName ?? "A customer";
  const stars = "★".repeat(opts.rating) + "☆".repeat(5 - opts.rating);
  const reviewUrl = `${opts.appUrl}/app/locations/${opts.locationId}/reviews`;

  const subject = `${opts.rating}-star review for ${opts.locationName}`;

  const text = `${reviewer} left a ${opts.rating}-star review for ${opts.locationName}.

${stars}
${opts.comment ? `\n"${opts.comment}"\n` : ""}
You can see it (and draft a reply) here:
${reviewUrl}

This alert was sent automatically by BAAM Review.`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    <p style="margin: 0 0 12px 0;">
      <strong>${escapeHtml(reviewer)}</strong> left a
      <strong>${opts.rating}-star</strong> review for
      <strong>${escapeHtml(opts.locationName)}</strong>.
    </p>
    <p style="font-size: 18px; color: #C9A961; margin: 0 0 12px 0;">${stars}</p>
    ${
      opts.comment
        ? `<blockquote style="margin: 0 0 16px 0; padding: 8px 14px; border-left: 3px solid #B5443A; background: #FAF7F2; color: #1A1F1C; font-style: italic;">${escapeHtml(opts.comment)}</blockquote>`
        : ""
    }
    <p style="margin: 0 0 18px 0;">
      <a href="${reviewUrl}" style="color: #1F4D3F; font-weight: 500;">View the review and draft a reply →</a>
    </p>
    <p style="font-size: 12px; color: #8A938E; margin: 0;">
      Sent automatically by BAAM Review when a new 1- or 2-star review was synced from Google.
    </p>
  </body>
</html>`;

  await sendEmailViaResend({
    to: opts.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
