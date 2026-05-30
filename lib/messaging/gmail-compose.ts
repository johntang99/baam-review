export function asEmailOrEmpty(value: string | null | undefined): string {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

export function buildGmailComposeHref(params: {
  to: string;
  subject: string;
  body: string;
  senderGmail: string;
}): string {
  const { to, subject, body, senderGmail } = params;
  const composeBase =
    `https://mail.google.com/mail/?view=cm&fs=1&tf=1` +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  if (!senderGmail) return composeBase;

  const continueUrl = `${composeBase}&authuser=${encodeURIComponent(senderGmail)}`;
  return (
    `https://accounts.google.com/AccountChooser` +
    `?Email=${encodeURIComponent(senderGmail)}` +
    `&continue=${encodeURIComponent(continueUrl)}`
  );
}
