<?xml version="1.0" encoding="UTF-8"?>
<!--
  XSLT stylesheet that browsers apply when rendering /sitemap.xml.

  Crawlers (Googlebot, Bingbot, etc.) ignore this and read the raw XML
  directly. Humans get a clean, branded HTML table instead of a
  collapsed text dump.

  Pattern lifted from Yoast's WordPress sitemap, simplified + restyled
  in the BAAM Review palette (cream paper, ink text, gold + forest
  accents).
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="sm xhtml">

<xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"
  doctype-system="about:legacy-compat"/>

<xsl:template match="/">
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>BAAM Review · Sitemap</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&amp;family=Onest:wght@400;500;600&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
  <style>
    :root {
      --cream: #FAF7F2;
      --cream-deep: #F4EFE2;
      --paper: #FBF8F1;
      --ink: #1c1c1c;
      --text: #2a2a2a;
      --text-soft: #555;
      --text-muted: #888;
      --border: #E6DECF;
      --rule: #DDD3BF;
      --forest: #2D4A3A;
      --gold: #C9A961;
      --gold-dark: #6F5320;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Onest', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--cream);
      color: var(--text);
      line-height: 1.55;
      font-size: 14px;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 28px 80px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }
    .brand-mark {
      width: 34px; height: 34px;
      background: var(--forest);
      color: var(--cream);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: 'Fraunces', serif;
      font-size: 18px;
      font-weight: 500;
    }
    .brand-name {
      font-family: 'Fraunces', serif;
      font-size: 18px;
      color: var(--ink);
      font-weight: 500;
    }
    .header {
      margin: 26px 0 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gold-dark);
      font-weight: 600;
      margin-bottom: 12px;
    }
    h1 {
      font-family: 'Fraunces', serif;
      font-weight: 400;
      font-size: 36px;
      letter-spacing: -0.02em;
      color: var(--ink);
      margin-bottom: 10px;
    }
    .deck {
      color: var(--text-soft);
      font-size: 15px;
      max-width: 640px;
      line-height: 1.55;
    }
    .deck code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: var(--cream-deep);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .stats {
      display: flex;
      gap: 28px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-num {
      font-family: 'Fraunces', serif;
      font-size: 26px;
      font-weight: 500;
      color: var(--ink);
      letter-spacing: -0.01em;
      line-height: 1;
    }
    .stat-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 600;
    }
    .table-wrap {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: var(--cream-deep);
      text-align: left;
      padding: 12px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    thead th.num { text-align: right; }
    tbody td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--cream-deep);
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:hover { background: rgba(201, 169, 97, 0.04); }
    td.num {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      color: var(--text-soft);
    }
    a.url {
      color: var(--forest);
      text-decoration: none;
      font-weight: 500;
      word-break: break-all;
    }
    a.url:hover { text-decoration: underline; }
    .changefreq {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gold-dark);
      background: rgba(201, 169, 97, 0.15);
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .lastmod {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
    }
    .priority-bar {
      display: inline-block;
      background: var(--cream-deep);
      border-radius: 999px;
      height: 6px;
      width: 60px;
      vertical-align: middle;
      margin-right: 8px;
      overflow: hidden;
    }
    .priority-fill {
      display: block;
      height: 100%;
      background: var(--gold);
      border-radius: 999px;
    }
    .footnote {
      margin-top: 24px;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.6;
      font-style: italic;
      max-width: 640px;
    }
    .footnote code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      font-style: normal;
      background: var(--cream-deep);
      padding: 1px 5px;
      border-radius: 3px;
    }
    @media (max-width: 720px) {
      .wrap { padding: 20px 16px 60px; }
      h1 { font-size: 26px; }
      tbody td, thead th { padding: 10px 12px; font-size: 12.5px; }
      .priority-bar { display: none; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <a href="/" class="brand">
      <span class="brand-mark">B</span>
      <span class="brand-name">BAAM Review</span>
    </a>

    <header class="header">
      <p class="eyebrow">XML Sitemap</p>
      <h1>Sitemap</h1>
      <p class="deck">
        Every public page on <code>baamreview.com</code>, indexable by
        search engines and AI crawlers. This human-readable view is for
        you — crawlers see the raw XML.
      </p>
      <div class="stats">
        <div class="stat">
          <div class="stat-num"><xsl:value-of select="count(sm:urlset/sm:url)"/></div>
          <div class="stat-label">Total URLs</div>
        </div>
        <div class="stat">
          <div class="stat-num"><xsl:value-of select="count(sm:urlset/sm:url[starts-with(sm:loc, 'https://baamreview.com/blog/')])"/></div>
          <div class="stat-label">Blog posts</div>
        </div>
        <div class="stat">
          <div class="stat-num"><xsl:value-of select="count(sm:urlset/sm:url[starts-with(sm:loc, 'https://baamreview.com/local/')])"/></div>
          <div class="stat-label">City pages</div>
        </div>
      </div>
    </header>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Last modified</th>
            <th>Change freq.</th>
            <th class="num">Priority</th>
          </tr>
        </thead>
        <tbody>
          <xsl:for-each select="sm:urlset/sm:url">
            <xsl:sort select="sm:priority" order="descending" data-type="number"/>
            <tr>
              <td>
                <a class="url">
                  <xsl:attribute name="href"><xsl:value-of select="sm:loc"/></xsl:attribute>
                  <xsl:value-of select="sm:loc"/>
                </a>
              </td>
              <td class="lastmod">
                <xsl:value-of select="substring(sm:lastmod, 1, 10)"/>
              </td>
              <td>
                <span class="changefreq"><xsl:value-of select="sm:changefreq"/></span>
              </td>
              <td class="num">
                <span class="priority-bar">
                  <span class="priority-fill">
                    <xsl:attribute name="style">width: <xsl:value-of select="number(sm:priority) * 100"/>%;</xsl:attribute>
                  </span>
                </span>
                <xsl:value-of select="format-number(sm:priority, '0.00')"/>
              </td>
            </tr>
          </xsl:for-each>
        </tbody>
      </table>
    </div>

    <p class="footnote">
      Sitemap auto-generated from <code>app/sitemap.xml/route.ts</code>.
      New blog posts and city pages appear here as soon as they're
      published. Submitted to Google Search Console and Bing Webmaster
      Tools.
    </p>
  </main>
</body>
</html>
</xsl:template>

</xsl:stylesheet>
