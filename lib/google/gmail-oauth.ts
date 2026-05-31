import "server-only";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function getGmailRedirectUri(origin: string) {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
    `${origin}/api/auth/google/gmail/callback`
  );
}

export function getGmailScopes(): string[] {
  const configured = process.env.GOOGLE_GMAIL_SCOPE?.trim() || "";
  const scopes = configured
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const scopeSet = new Set<string>(scopes);

  // Always request gmail.send + identity scopes so we can show the
  // connected Gmail address in the UI after OAuth callback.
  scopeSet.add("https://www.googleapis.com/auth/gmail.send");
  scopeSet.add("openid");
  scopeSet.add("email");

  return [...scopeSet];
}

export function buildGmailConsentUrl(opts: {
  origin: string;
  state: string;
}): string {
  const clientId = requireEnv("GOOGLE_GMAIL_CLIENT_ID");
  const includeGrantedScopes =
    process.env.GOOGLE_GMAIL_OAUTH_INCLUDE_GRANTED_SCOPES === "true";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGmailRedirectUri(opts.origin),
    response_type: "code",
    scope: getGmailScopes().join(" "),
    access_type: "offline",
    prompt: "consent",
    state: opts.state,
  });
  if (includeGrantedScopes) {
    params.set("include_granted_scopes", "true");
  }

  return `${AUTH_URL}?${params.toString()}`;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry: Date;
  scope: string;
  id_token?: string;
}

export async function exchangeGmailCodeForTokens(opts: {
  code: string;
  origin: string;
}): Promise<GmailTokens> {
  const clientId = requireEnv("GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_GMAIL_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: getGmailRedirectUri(opts.origin),
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };

  if (!json.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token for Gmail OAuth. Revoke app access at https://myaccount.google.com/permissions and re-consent.",
    );
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
    id_token: json.id_token,
  };
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry: Date;
}> {
  const clientId = requireEnv("GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_GMAIL_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    access_token: json.access_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
  };
}

export async function fetchGmailUserinfo(
  accessToken: string,
): Promise<{ email: string; sub: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail userinfo failed (${res.status})`);
  }
  return (await res.json()) as { email: string; sub: string };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
