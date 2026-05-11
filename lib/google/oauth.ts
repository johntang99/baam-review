import "server-only";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/business.manage",
];

export function getRedirectUri(origin: string) {
  return `${origin}/api/auth/google/callback`;
}

export function buildConsentUrl(opts: {
  origin: string;
  state: string;
}): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const includeGrantedScopes =
    process.env.GOOGLE_OAUTH_INCLUDE_GRANTED_SCOPES === "true";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(opts.origin),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: opts.state,
  });
  if (includeGrantedScopes) {
    params.set("include_granted_scopes", "true");
  }

  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry: Date;
  scope: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  origin: string;
}): Promise<GoogleTokens> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(opts.origin),
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
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
      "Google did not return a refresh_token. The user likely already granted consent — revoke at https://myaccount.google.com/permissions and retry, or pass prompt=consent.",
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

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry: Date;
}> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

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
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
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

export async function fetchGoogleUserinfo(
  accessToken: string,
): Promise<{ email: string; sub: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed (${res.status})`);
  }
  return (await res.json()) as { email: string; sub: string };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}
