import { type NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Serves the public embed snippet. Two modes:
 *
 *   Button (data-mode="button" or unset) — renders a single CTA button.
 *
 *     <script src="https://review.baamplatform.com/api/embed.js"
 *             data-slug="<their-slug>"
 *             data-color="#1F4D3F"
 *             data-label="Leave a review"></script>
 *
 *   Widget (data-mode="widget") — injects an iframe pointing at
 *   /widget/<slug> that shows the curated review carousel + JSON-LD.
 *   The iframe auto-resizes via postMessage from the widget tracker.
 *
 *     <script src="https://review.baamplatform.com/api/embed.js"
 *             data-slug="<their-slug>"
 *             data-mode="widget"
 *             data-color="#1F4D3F"></script>
 *
 * The IIFE below reads data-attributes from `document.currentScript`.
 * All styles inlined so customer CSS resets don't break us.
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
  return `/*! BAAM Review embed — v2 */
(function(){
  var BASE = ${JSON.stringify(base)};
  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute('data-slug');
  if (!slug) return;
  var mode = script.getAttribute('data-mode') || 'button';
  var color = script.getAttribute('data-color') || '#1F4D3F';
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

  if (mode === 'widget') {
    renderWidget();
  } else {
    renderButton();
  }

  function renderButton() {
    var label = script.getAttribute('data-label') || 'Leave a review';
    var url = BASE + '/r/' + encodeURIComponent(slug) + '?source=embed' + (lang ? '&lang=' + encodeURIComponent(lang) : '');

    var btn = document.createElement('a');
    btn.href = url;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label', label);
    btn.textContent = label;

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
  }

  function renderWidget() {
    // Read every supported data-* attribute and forward it to the widget URL.
    // Anything absent here falls back to the location's saved widget_config.
    var WIDGET_PARAMS = [
      { attr: 'data-layout',       qs: 'layout' },
      { attr: 'data-color',        qs: 'accent' },
      { attr: 'data-accent',       qs: 'accent' },
      { attr: 'data-min-rating',   qs: 'min_rating' },
      { attr: 'data-max',          qs: 'max' },
      { attr: 'data-aggregate',    qs: 'aggregate' },
      { attr: 'data-leave-own',    qs: 'leave_own' },
      { attr: 'data-reply',        qs: 'reply' },
      { attr: 'data-max-width',    qs: 'max_width' },
      { attr: 'data-comment-lang', qs: 'comment_lang' },
      { attr: 'data-title',        qs: 'title' },
      { attr: 'data-subtitle',     qs: 'subtitle' }
    ];

    var qs = [];
    if (lang) qs.push('lang=' + encodeURIComponent(lang));
    for (var i = 0; i < WIDGET_PARAMS.length; i++) {
      var p = WIDGET_PARAMS[i];
      var v = script.getAttribute(p.attr);
      if (v !== null && v !== '') {
        qs.push(p.qs + '=' + encodeURIComponent(v));
      }
    }
    var src = BASE + '/widget/' + encodeURIComponent(slug);
    if (qs.length) src += '?' + qs.join('&');

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'Customer reviews';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');

    var s = iframe.style;
    s.display = 'block';
    s.width = '100%';
    s.border = '0';
    s.background = 'transparent';
    s.colorScheme = 'normal';
    s.minHeight = '320px';
    // Respect data-max-width on the iframe too so the iframe element itself
    // doesn't overflow its container on very wide pages.
    var mw = script.getAttribute('data-max-width');
    if (mw && /^\\d{2,5}$/.test(mw)) {
      s.maxWidth = parseInt(mw, 10) + 'px';
      s.marginLeft = 'auto';
      s.marginRight = 'auto';
    }

    // Listen for height messages from /widget/[slug]'s WidgetTracker.
    window.addEventListener('message', function(e){
      if (!e || !e.data || e.data.type !== 'baam-widget-resize') return;
      var h = parseInt(e.data.height, 10);
      if (!isNaN(h) && h > 0) iframe.style.height = h + 'px';
    });

    if (script.parentNode) {
      script.parentNode.insertBefore(iframe, script.nextSibling);
    }
  }
})();`;
}
