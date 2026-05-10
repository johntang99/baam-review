/**
 * Detects WeChat in-app browser. WeChat blocks Google sign-in, so a Chinese
 * customer who taps the SMS link inside WeChat will silently fail at the
 * Google handoff. We surface a "open in browser" hint when this is the case.
 *
 * The MicroMessenger token is the canonical fingerprint and has been stable
 * for years. WeChat is the only common in-app browser that breaks this flow
 * — Instagram and Facebook in-app browsers handle Google fine.
 */
export function isWeChatBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /MicroMessenger/i.test(userAgent);
}
