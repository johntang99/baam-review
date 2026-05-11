import { type NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Serves the public embed snippet. Customer pastes:
 *
 *   <script src="https://review.baamplatform.com/api/embed.js"
 *           data-slug="<their-slug>"
 *           data-color="#1F4D3F"
 *           data-label="Leave a review"></script>
 *
 * The IIFE below reads data-attributes from `document.currentScript`,
 * fires a fire-and-forget load tracking ping, and renders a styled
 * button — inline at the script tag's position, or fixed bottom-right
 * if data-position="fixed".
 *
 * All styles inlined so customer CSS resets don't break the button.
 */
export async function GET(request: NextRequest) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const js = buildEmbedJs(base);

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache aggressively at the edge — embed JS is static per deploy.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildEmbedJs(base: string): string {
  // The BASE_URL placeholder is replaced at build time; everything inside
  // the IIFE is plain ES5-compatible JS to maximize old-browser reach
  // (the embed runs on customer sites we don't control).
  return `/*! BAAM Review embed — v1 */
(function(){
  var BASE = ${JSON.stringify(base)};
  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute('data-slug');
  if (!slug) return;
  var color = script.getAttribute('data-color') || '#1F4D3F';
  var label = script.getAttribute('data-label') || 'Leave a review';
  var lang = script.getAttribute('data-lang') || '';
  var position = script.getAttribute('data-position') || 'inline';

  // Fire-and-forget load tracking. no-cors lets the request go through
  // without preflight; we only care about the server-side log.
  try {
    fetch(
      BASE + '/api/embed-load?slug=' + encodeURIComponent(slug),
      { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store' }
    );
  } catch (e) {}

  var url = BASE + '/r/' + encodeURIComponent(slug) + '?source=embed' + (lang ? '&lang=' + encodeURIComponent(lang) : '');

  var btn = document.createElement('a');
  btn.href = url;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.setAttribute('aria-label', label);
  btn.textContent = label;

  // Inline styles so the customer's CSS reset doesn't break us.
  var s = btn.style;
  s.display = 'inline-flex';
  s.alignItems = 'center';
  s.justifyContent = 'center';
  s.padding = '10px 18px';
  s.background = color;
  s.color = '#FAF7F2';
  s.border = '0';
  s.borderRadius = '10px';
  s.fontSize = '14px';
  s.fontWeight = '500';
  s.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  s.textDecoration = 'none';
  s.cursor = 'pointer';
  s.lineHeight = '1';
  s.transition = 'transform .15s ease, box-shadow .15s ease';
  s.WebkitTapHighlightColor = 'transparent';

  if (position === 'fixed') {
    s.position = 'fixed';
    s.bottom = '24px';
    s.right = '24px';
    s.zIndex = '2147483646';
    s.boxShadow = '0 6px 18px rgba(15, 31, 26, 0.18)';
  } else {
    s.boxShadow = '0 1px 2px rgba(15, 31, 26, 0.06)';
  }

  btn.addEventListener('mouseenter', function(){ s.transform = 'translateY(-1px)'; });
  btn.addEventListener('mouseleave', function(){ s.transform = 'translateY(0)'; });

  if (position === 'fixed') {
    if (document.body) document.body.appendChild(btn);
    else document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(btn); });
  } else if (script.parentNode) {
    script.parentNode.insertBefore(btn, script.nextSibling);
  }
})();`;
}
