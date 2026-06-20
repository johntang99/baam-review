import Link from "next/link";
import { getBenchmarks } from "@/lib/audit/benchmarks";
import { computeProjection } from "@/lib/audit/projection";
import { buildAuditViewModel } from "@/lib/audit/templating";
import type { AuditCompetitorsData } from "@/lib/audit/competitors/types";
import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { AuditScore } from "@/lib/audit/scoring/types";
import type { RegionKey } from "@/lib/audit/benchmarks/types";

export type ShortReportLanguage = "en" | "zh";

export interface AuditShortRow {
  id: string;
  user_id: string | null;
  is_public: boolean | null;
  tier: string;
  vertical: string;
  region: string;
  generated_at: string;
  google_data: AuditGoogleData;
  competitors_data: AuditCompetitorsData;
  score_data: AuditScore;
  platforms_data: import("@/lib/audit/platforms/types").AuditPlatformsData | null;
}

const GRADE_LADDER_EN = [
  { range: "90 – 100", grade: "A", meaning: "Winning your local market with a review moat." },
  { range: "75 – 89", grade: "B", meaning: "Strong, but top competitors can still gain on you." },
  { range: "60 – 74", grade: "C", meaning: "Visible, but customers often pick better-reviewed alternatives." },
  { range: "40 – 59", grade: "D", meaning: "Losing customers weekly to stronger nearby review profiles." },
  { range: "0 – 39", grade: "F", meaning: "Effectively invisible in search and AI answers." },
] as const;

const GRADE_LADDER_ZH = [
  { range: "90 – 100", grade: "A", meaning: "在本地市場領先，評論已成為競爭護城河。" },
  { range: "75 – 89", grade: "B", meaning: "基礎很強，但頂尖對手仍可能持續逼近。" },
  { range: "60 – 74", grade: "C", meaning: "仍有能見度，但客戶常改選評價更強的商家。" },
  { range: "40 – 59", grade: "D", meaning: "每週都在流失客戶給評論更強的競爭者。" },
  { range: "0 – 39", grade: "F", meaning: "在搜尋與 AI 回答中幾乎看不見。" },
] as const;

function pickShortCompetitorRows<
  T extends { isYou: boolean; score: number; name: string },
>(rows: T[], target = 8): T[] {
  if (rows.length <= target) return rows;
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, target);
  const you = sorted.find((row) => row.isYou);
  if (you && !selected.some((row) => row.isYou)) {
    selected[target - 1] = you;
    selected.sort((a, b) => b.score - a.score);
  }
  return selected;
}

export interface ShortReportModel {
  language: ShortReportLanguage;
  isZh: boolean;
  auditId: string;
  businessName: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  metrics: Array<{ label: string; fillPct: number; score: number }>;
  competitorRows: Array<{
    rank: number;
    name: string;
    isYou: boolean;
    score: number;
    rating: string;
    total: number;
    last30d: string | number;
  }>;
  actions: string[];
  gradeLadder: ReadonlyArray<{ range: string; grade: string; meaning: string }>;
  ui: {
    back: string;
    kicker: string;
    sentenceA: string;
    sentenceB: string;
    scoreTitle: string;
    gradeTableTitle: string;
    gradeNotePrefix: string;
    gradeNoteSuffix: string;
    yourBusinessTag: string;
    yourRowTag: string;
    competitorsTitle: string;
    businessesWord: string;
    actionsTitle: string;
    plusLine: string;
    trialLine: string;
    ctaLine: string;
    contactLine: string;
    ps: string;
    psLine: string;
    scoreRange: string;
    gradeCol: string;
    meaningCol: string;
    rankCol: string;
    businessCol: string;
    scoreCol: string;
    ratingCol: string;
    totalCol: string;
    last30dCol: string;
  };
}

export async function buildShortReportModel(
  audit: AuditShortRow,
  language: ShortReportLanguage,
): Promise<ShortReportModel> {
  const isZh = language === "zh";
  const benchmarks = await getBenchmarks(
    audit.vertical as Parameters<typeof getBenchmarks>[0],
    audit.region as RegionKey,
  );
  const projection = computeProjection(
    audit.google_data,
    audit.competitors_data,
    audit.score_data,
    benchmarks,
  );
  const view = buildAuditViewModel({
    google: audit.google_data,
    competitors: audit.competitors_data,
    score: audit.score_data,
    projection,
    benchmarks,
    platforms: audit.platforms_data ?? undefined,
    tier: audit.tier as "free" | "paid",
    language,
    audit_id: audit.id,
    prepared_at: new Date(audit.generated_at),
  });

  const fullRankedRows = [...view.competitor_rows]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      isYou: row.is_you,
      score: row.score,
      rating: String(row.rating_display).replace(" ★", "★"),
      total: row.total_count,
      last30d: row.last_30d,
    }));
  const competitorRows = pickShortCompetitorRows(fullRankedRows, 8);

  const ui = isZh
    ? {
        back: "返回完整報告",
        kicker: "REVIEW AUDIT REPORT",
        sentenceA: "如果客戶找不到您，就無法選擇您",
        sentenceB: "Google 與 AI 搜尋對商家排序越來越依賴評論",
        scoreTitle: "評分摘要",
        gradeTableTitle: "等級階梯（A–F）",
        gradeNotePrefix: "您的商家目前在",
        gradeNoteSuffix: "級。",
        yourBusinessTag: "您的商家",
        yourRowTag: "你",
        competitorsTitle: "競爭對手比較",
        businessesWord: "商家",
        actionsTitle: "接下來請先做這 3 件事：",
        plusLine: "另外，您將獲得轉介紹與留存提升工具。",
        trialLine: "30 天免費試用，無合約，可隨時取消。",
        ctaLine: "立即試用：BaamReview.com",
        contactLine: "任何問題，歡迎直接聯繫我們。",
        ps: "附註",
        psLine: "評論不是最終目標。它們是建立信任、內容、SEO、轉介紹與營收的原材料。",
        scoreRange: "分數區間",
        gradeCol: "等級",
        meaningCol: "代表意義",
        rankCol: "名次",
        businessCol: "商家",
        scoreCol: "分數",
        ratingCol: "評分",
        totalCol: "總評論",
        last30dCol: "近30天",
      }
    : {
        back: "Back to full report",
        kicker: "REVIEW AUDIT REPORT",
        sentenceA: "Customers can't choose you if they can't find you",
        sentenceB: "Google and AI search rank businesses on reviews",
        scoreTitle: "Score Summary",
        gradeTableTitle: "Grade Ladder (A–F)",
        gradeNotePrefix: "Your business is currently in Grade",
        gradeNoteSuffix: ".",
        yourBusinessTag: "YOUR BUSINESS",
        yourRowTag: "YOU",
        competitorsTitle: "Competitor Comparison",
        businessesWord: "businesses",
        actionsTitle: "Do the following to get more reviews:",
        plusLine: "Plus, you'll get access to our referral and retention tool.",
        trialLine: "30-day free trial, no contract, cancel anytime.",
        ctaLine: "Try it out at BaamReview.com",
        contactLine: "Any questions, please contact us.",
        ps: "P.S.",
        psLine:
          "Reviews are not the end goal. They are the raw material for trust, content, SEO, referrals, and revenue.",
        scoreRange: "Score Range",
        gradeCol: "Grade",
        meaningCol: "What it means",
        rankCol: "Rank",
        businessCol: "Business",
        scoreCol: "Score",
        ratingCol: "Rating",
        totalCol: "Total",
        last30dCol: "Last 30d",
      };

  return {
    language,
    isZh,
    auditId: audit.id,
    businessName: view.business_name,
    score: view.score_total,
    grade: view.score_grade,
    metrics: view.subscore_rows.slice(0, 5).map((m) => ({
      label: m.label,
      fillPct: m.fill_pct,
      score: m.score,
    })),
    competitorRows,
    actions: view.action_items.slice(0, 3).map((a) => a.title),
    gradeLadder: isZh ? GRADE_LADDER_ZH : GRADE_LADDER_EN,
    ui,
  };
}

export const SHORT_REPORT_STYLES = `
  .short-letter-root {
    background: #ffffff;
    min-height: 100vh;
    padding: 20px 16px 40px;
    color: #1a1814;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    line-height: 1.45;
  }
  .short-letter-topbar {
    max-width: 640px;
    margin: 0 auto 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .short-letter-topbar-left,
  .short-letter-topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .short-letter-chip {
    color: #3d3833;
    text-decoration: none;
    font-size: 12px;
    border: 1px solid #c9bfae;
    background: #fff;
    padding: 6px 10px;
    border-radius: 999px;
  }
  .short-letter-chip.primary {
    border-color: #1a1814;
    color: #1a1814;
    font-weight: 600;
  }
  .short-letter-audit-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #6b6259;
  }
  .short-letter-page {
    max-width: 640px;
    margin: 0 auto 20px;
    background: #fff;
    border: 1px solid #ddd3bf;
    padding: 30px 26px;
    page-break-after: always;
  }
  .short-letter-page.page:last-of-type { page-break-after: auto; }
  .short-letter-kicker {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: #6b6259;
    text-transform: uppercase;
    margin: 0 auto 10px;
    text-align: center;
    width: fit-content;
  }
  .short-letter-title {
    margin: 0 auto;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 42px;
    line-height: 1.02;
    color: #842f1b;
    display: block;
    width: fit-content;
    padding: 0;
  }
  .short-letter-subtitle {
    margin: 18px 0 4px;
    font-size: 21px;
    line-height: 1.15;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: -0.01em;
    text-align: center;
  }
  .short-letter-subtitle.soft {
    margin: 0 0 24px;
    color: #3d3833;
  }
  .short-letter-card {
    border: 1px solid #c9bfae;
    background: #fff;
    padding: 16px;
    margin-bottom: 24px;
  }
  .score-title {
    margin: 0 0 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6b6259;
    font-weight: 600;
  }
  .score-row {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 16px;
    align-items: center;
    border-bottom: 1px solid #c9bfae;
    padding-bottom: 12px;
    margin-bottom: 10px;
  }
  .score-big {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 72px;
    line-height: 0.92;
    letter-spacing: -0.02em;
    color: #1a1814;
  }
  .score-big span {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    color: #6b6259;
    margin-left: 6px;
  }
  .grade-box {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }
  .grade-letter {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 58px;
    line-height: 0.92;
    color: #842f1b;
  }
  .grade-copy {
    font-size: 12px;
    color: #3d3833;
    max-width: 230px;
  }
  .metric {
    display: grid;
    grid-template-columns: 136px 1fr 42px;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
    font-size: 12px;
  }
  .metric .label {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b6259;
  }
  .bar {
    height: 8px;
    background: #f3efe6;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid #ddd3bf;
  }
  .bar > i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #9f3f24 0%, #b86e1a 60%, #bda36b 100%);
  }
  .num {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
  }
  .section-title {
    margin: 26px 0 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6b6259;
    font-weight: 600;
  }
  .section-title-strong {
    margin: 4px 0 16px;
    font-size: 28px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: #1a1814;
  }
  .grade-note {
    margin: 0 0 12px;
    font-size: 13px;
    color: #3d3833;
  }
  .grade-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border: 1px solid #c9bfae;
    font-size: 12px;
  }
  .grade-table th {
    text-align: left;
    padding: 8px 9px;
    border-bottom: 1px solid #c9bfae;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b6259;
    font-weight: 500;
  }
  .grade-table td {
    padding: 8px 9px;
    border-bottom: 1px solid #ddd3bf;
    vertical-align: middle;
    font-size: 13px;
  }
  .grade-table tr:last-child td { border-bottom: none; }
  .grade-table th:nth-child(1),
  .grade-table td:nth-child(1) { width: 124px; }
  .grade-table th:nth-child(2),
  .grade-table td:nth-child(2) { width: 176px; }
  .grade-table th:nth-child(3),
  .grade-table td:nth-child(3) {
    white-space: nowrap;
    font-size: 12px;
  }
  .grade-letter-pill {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    line-height: 1;
    color: #842f1b;
  }
  .grade-table tr.you-grade { background: #faf7f0; }
  .you-tag {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 7px;
    border-radius: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #faf7f0;
    background: #842f1b;
    vertical-align: middle;
  }
  .mini-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border: 1px solid #c9bfae;
    font-size: 12px;
    margin-bottom: 28px;
  }
  .mini-table th {
    text-align: left;
    padding: 8px 9px;
    border-bottom: 1px solid #c9bfae;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b6259;
    font-weight: 500;
  }
  .mini-table td {
    padding: 8px 9px;
    border-bottom: 1px solid #ddd3bf;
    vertical-align: middle;
    font-size: 13px;
  }
  .mini-table tr:last-child td { border-bottom: none; }
  .mini-table tr.you-grade { background: #faf7f0; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .action-headline {
    margin: 6px 0 18px;
    font-size: 28px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .short-action-list {
    margin: 0;
    padding-left: 24px;
    font-size: 19px;
    line-height: 1.4;
  }
  .short-action-list li { margin: 6px 0; }
  .para {
    margin: 22px 0 0;
    font-size: 20px;
    line-height: 1.35;
  }
  .offer-layout {
    margin-top: 24px;
    display: grid;
    grid-template-columns: 6fr 4fr;
    gap: 8px;
    align-items: stretch;
  }
  .offer-block {
    border: 1px solid #c9bfae;
    background: #fff;
    padding: 14px 16px;
    font-size: 18px;
    line-height: 1.35;
  }
  .offer-block p { margin: 0 0 8px; }
  .offer-block p:last-child { margin-bottom: 0; }
  .offer-block strong { color: #842f1b; }
  .offer-notes-box {
    border: 1px solid #c9bfae;
    background: #fff;
    min-height: 100%;
  }
  .ps-block {
    margin-top: 110px;
    padding-top: 14px;
    border-top: 1px solid #c9bfae;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ps-inline {
    margin: 0;
    color: #3d3833;
    font-size: 17px;
    line-height: 1.4;
    max-width: 560px;
  }
  .ps-prefix {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 28px;
    color: #1a1814;
    margin-right: 8px;
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .short-letter-page { padding: 22px 16px; }
    .short-letter-title { font-size: 34px; }
    .short-letter-subtitle { font-size: 28px; white-space: normal; }
    .score-row { grid-template-columns: 1fr; }
    .score-big { font-size: 64px; }
    .grade-table th:nth-child(3),
    .grade-table td:nth-child(3) { white-space: normal; }
    .section-title-strong { font-size: 24px; }
    .action-headline { font-size: 24px; }
    .short-action-list { font-size: 18px; }
    .para { font-size: 19px; }
    .offer-layout {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .offer-block { font-size: 18px; }
    .offer-notes-box { min-height: 90px; }
    .ps-block { margin-top: 84px; }
    .ps-inline { font-size: 17px; }
    .ps-prefix { font-size: 26px; }
  }
  @media print {
    @page { size: Letter portrait; margin: 12mm; }
    .short-letter-root { background: #fff; padding: 0; }
    .short-letter-topbar { display: none; }
    .short-letter-subtitle { margin-top: 14px; }
    .short-letter-subtitle.soft { margin-bottom: 44px; }
    .short-letter-page {
      border: none;
      margin: 0 auto;
      padding: 8mm 6mm;
      min-height: auto;
      page-break-after: always;
      break-after: page;
    }
    .short-letter-page:last-of-type {
      page-break-after: auto;
      break-after: auto;
    }
    .offer-layout {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .offer-notes-box { min-height: 0; }
    .ps-block { margin-top: 36px; }
  }
`;

interface TopbarProps {
  backHref: string;
  backLabel: string;
  auditIdLabel: string;
  langToggleHref: string;
  langToggleLabel: string;
  htmlDownloadHref: string;
  pdfDownloadHref: string;
}

export function ShortReportBody({
  model,
  topbar,
}: {
  model: ShortReportModel;
  topbar?: TopbarProps;
}) {
  const { isZh, ui } = model;

  return (
    <main className="short-letter-root">
      {topbar ? (
        <div className="short-letter-topbar">
          <div className="short-letter-topbar-left">
            <Link href={topbar.backHref} className="short-letter-chip">
              ← {topbar.backLabel}
            </Link>
            <span className="short-letter-audit-id">{topbar.auditIdLabel}</span>
          </div>
          <div className="short-letter-topbar-right">
            <Link href={topbar.langToggleHref} className="short-letter-chip">
              {topbar.langToggleLabel}
            </Link>
            <a href={topbar.htmlDownloadHref} className="short-letter-chip">
              Short HTML
            </a>
            <a href={topbar.pdfDownloadHref} className="short-letter-chip primary">
              Short PDF
            </a>
          </div>
        </div>
      ) : null}

      <section className="short-letter-page page">
        <div className="short-letter-kicker">{ui.kicker}</div>
        <h1 className="short-letter-title">{model.businessName}</h1>
        <p className="short-letter-subtitle">{ui.sentenceA}</p>
        <p className="short-letter-subtitle soft">{ui.sentenceB}</p>

        <div className="short-letter-card">
          <h2 className="score-title">{ui.scoreTitle}</h2>
          <div className="score-row">
            <div className="score-big">
              {model.score}
              <span>/100</span>
            </div>
            <div className="grade-box">
              <div className="grade-letter">{model.grade}</div>
              <div className="grade-copy">
                {model.gradeLadder.find((row) => row.grade === model.grade)?.meaning}
              </div>
            </div>
          </div>

          {model.metrics.map((metric) => (
            <div className="metric" key={metric.label}>
              <div className="label">{metric.label}</div>
              <div className="bar">
                <i style={{ width: `${Math.max(0, Math.min(100, metric.fillPct))}%` }} />
              </div>
              <div className="num">{metric.score}</div>
            </div>
          ))}
        </div>

        <p className="section-title">{ui.gradeTableTitle}</p>
        <p className="grade-note">
          {ui.gradeNotePrefix} <strong>{model.grade}</strong>
          {ui.gradeNoteSuffix}
        </p>
        <table className="grade-table">
          <thead>
            <tr>
              <th>{ui.scoreRange}</th>
              <th>{ui.gradeCol}</th>
              <th>{ui.meaningCol}</th>
            </tr>
          </thead>
          <tbody>
            {model.gradeLadder.map((row) => (
              <tr
                key={row.grade}
                className={row.grade === model.grade ? "you-grade" : undefined}
              >
                <td className="mono">{row.range}</td>
                <td>
                  <span className="grade-letter-pill">{row.grade}</span>
                  {row.grade === model.grade ? (
                    <span className="you-tag">{ui.yourBusinessTag}</span>
                  ) : null}
                </td>
                <td>{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="short-letter-page page">
        <p className="section-title-strong">
          {ui.competitorsTitle} ({model.competitorRows.length} {ui.businessesWord})
        </p>
        <table className="mini-table">
          <thead>
            <tr>
              <th>{ui.rankCol}</th>
              <th>{ui.businessCol}</th>
              <th>{ui.scoreCol}</th>
              <th>{ui.ratingCol}</th>
              <th>{ui.totalCol}</th>
              <th>{ui.last30dCol}</th>
            </tr>
          </thead>
          <tbody>
            {model.competitorRows.map((row) => (
              <tr key={`${row.rank}-${row.name}`} className={row.isYou ? "you-grade" : undefined}>
                <td className="mono">{row.rank}</td>
                <td>
                  {row.name}
                  {row.isYou ? <span className="you-tag">{ui.yourRowTag}</span> : null}
                </td>
                <td className="mono">{row.score}</td>
                <td className="mono">{row.rating}</td>
                <td className="mono">{row.total}</td>
                <td className="mono">{row.last30d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="action-headline">{ui.actionsTitle}</h2>
        <ol className="short-action-list">
          {model.actions.map((title, idx) => (
            <li key={`${title}-${idx}`}>{title}</li>
          ))}
        </ol>

        <p className="para">{ui.plusLine}</p>

        <div className="offer-layout">
          <div className="offer-block">
            <p>{ui.trialLine}</p>
            <p>
              <strong>{ui.ctaLine}</strong>
            </p>
            <p>{ui.contactLine}</p>
          </div>
          <div className="offer-notes-box" aria-label="Sales contact notes area" />
        </div>

        <div className="ps-block">
          <p className="ps-inline">
            <span className="ps-prefix">{ui.ps}</span>
            {ui.psLine}
          </p>
        </div>
      </section>
    </main>
  );
}
