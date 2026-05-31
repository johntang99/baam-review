import type { VerticalKey } from "../google/types";
import type { Grade, ComponentKey } from "../scoring/types";
import type { AuditLanguage } from "./types";

interface LabelSet {
  doc_header_subtitle: string;
  verticals: Record<VerticalKey, string>;
  grade_diagnoses: Record<Grade, string>;
  platforms: { google_name: string; google_meta: string };
  health: { verified: string; not_claimed: string };
  last_review: {
    never: string;
    today: string;
    yesterday: string;
    one_month: string;
    days: (n: number) => string;
    months: (n: number) => string;
  };
  subscore_labels: Record<ComponentKey, string>;
  composite_prefix: string;
  total_reviews_suffix: string;
  avg_suffix: string;
  footnotes: { rating: string; volume: string };
  insight_callout: (args: {
    rating: number;
    count: number;
    days_ago: number | null;
    weakest: ComponentKey;
  }) => string;
  projection_floor: {
    same_grade: string;
    dropped: (from: Grade, to: Grade) => string;
  };
  ranking_hold: string;
  gauge: { silent: string; min: string; optimal: string };
  velocity_pointer: (v: number) => string;
  money_on_table: (args: {
    competitor_avg: number;
    you_avg: number;
    gap: number;
    annual_loss: number;
  }) => string;
  you_tag: string;
  competitor_diagnosis_empty: string;
  competitor_diagnosis: (args: {
    top_name: string;
    top_velocity: number;
    you_velocity: number;
    multiple: number;
    per_review_value: number;
  }) => string;
  competitor_closing: (lower: number, total: number) => string;
  actions: ActionLabels;
  appendix_vertical: Record<string, string>;
}

interface ActionLabels {
  result_label: string;
  owner_baam: string;
  owner_baam_platform: string;
  owner_you: string;
  value_12mo: string;
  reviews_per_year: string;
  customers: string;
  per_review_value_label: string;
  ltv_label: string;
  post_visit: {
    title: string;
    why: string;
    result: (n: number) => string;
  };
  respond: { title: string; why: string; result: string };
  profile: { title: string; why: string; result: string };
  recover: {
    title: (unanswered: number) => string;
    why: string;
    result: string;
  };
  widget: { title: string; why: string; result: string };
}

const EN: LabelSet = {
  doc_header_subtitle: "Reputation & Revenue Diagnostic · v3.0",
  verticals: {
    tcm_clinic: "TCM Clinic",
    dental: "Dental",
    legal_immigration: "Immigration Law",
    restaurant: "Restaurant",
    real_estate: "Real Estate",
    hotel: "Hotel",
    auto: "Auto Services",
    contractor: "Contractor",
    salon_spa: "Salon / Spa",
    cafe: "Café",
    apparel: "Apparel",
    health_food: "Health Food",
    insurance: "Insurance",
    general_smb: "Local Business",
  },
  grade_diagnoses: {
    A: "Winning your local market. Reviews are a competitive moat.",
    B: "Strong — but losing ground to top competitors month over month.",
    C: "Visible — but customers are choosing competitors with stronger reviews.",
    D: "Bleeding customers to better-reviewed competitors every week.",
    F: "Effectively invisible. Search and AI are skipping you entirely.",
  },
  platforms: {
    google_name: "Google Business Profile",
    google_meta: "Primary · 81% of consumer reach",
  },
  health: { verified: "Verified", not_claimed: "Not Claimed" },
  last_review: {
    never: "never",
    today: "today",
    yesterday: "yesterday",
    one_month: "1 month ago",
    days: (n) => `${n} days ago`,
    months: (n) => `${n} months ago`,
  },
  subscore_labels: {
    rating_quality: "Rating Quality",
    review_volume: "Review Volume",
    velocity_30d: "30-Day Velocity",
    velocity_180d: "6-Month Velocity",
    velocity_365d: "12-Month Velocity",
  },
  composite_prefix: "composite",
  total_reviews_suffix: "total reviews",
  avg_suffix: "avg",
  footnotes: {
    rating: "Google rating · paid tier blends additional platforms",
    volume: "vs vertical median",
  },
  insight_callout: ({ rating, count, days_ago, weakest }) => {
    const recent =
      days_ago == null
        ? "Your Google profile has no reviews on record yet."
        : days_ago > 60
          ? `Your last Google review was ${days_ago} days ago — search and AI both interpret silence as decline.`
          : `Your most recent Google review was ${days_ago} days ago.`;
    const w =
      weakest === "velocity_30d"
        ? "Your weakest area is the past 30 days — that's the window Google's algorithm watches most closely."
        : weakest === "review_volume"
          ? `Your total of <strong>${count}</strong> reviews is below the median for your vertical — volume is your weakest area.`
          : weakest === "rating_quality"
            ? `Your composite ${rating.toFixed(2)}★ rating is the drag on your score.`
            : "Your weakest area is long-horizon velocity — sustained collection is the lever.";
    return `<strong>What this means</strong><br><br>${recent} ${w}`;
  },
  projection_floor: {
    same_grade: "Score holds — but the gap to top competitors widens with every silent month.",
    dropped: (from, to) =>
      `Drops from ${from} to ${to} · the critical floor rule triggers after 60 days of no new reviews`,
  },
  ranking_hold: "Hold position",
  gauge: { silent: "Silent", min: "Min", optimal: "Optimal" },
  velocity_pointer: (v) => `You · ${v.toFixed(1)}/mo`,
  money_on_table: ({ competitor_avg, you_avg, gap, annual_loss }) => {
    if (gap <= 0) {
      return `Your market is sleeping — competitors average <em>${competitor_avg.toFixed(1)} reviews/month</em>, you're at <em>${you_avg.toFixed(1)}</em>. The first business to consistently collect reviews wins this market outright.`;
    }
    return `Competitors in your area average <em>${competitor_avg.toFixed(1)} reviews per month.</em> You're averaging <em>${you_avg.toFixed(1)}.</em><br><br>The ${gap.toFixed(1)}-review monthly gap costs you approximately <strong>$${annual_loss.toLocaleString()} / year</strong> in lifetime customer value — calculated at the median per-review value for your vertical.`;
  },
  you_tag: "You",
  competitor_diagnosis_empty:
    "Your market has no comparable competitors within the audit radius — a rare advantage. Your only competition is the version of your business that doesn't collect reviews.",
  competitor_diagnosis: ({ top_name, top_velocity, you_velocity, multiple, per_review_value }) => {
    if (you_velocity >= top_velocity) {
      return `<strong>OBSERVED</strong> You're outpacing every competitor in this market by 30-day velocity — that lead is your moat. Sustain it.`;
    }
    const multStr = multiple > 1 ? `${multiple.toFixed(1)}× more reviews per month` : "more reviews per month";
    const perRev = `$${per_review_value.toLocaleString()}`;
    return `<strong>OBSERVED</strong> ${top_name} is gaining <strong>${multStr}</strong> than you. At a ${perRev} per-review value, every month they stay ahead compounds the rank gap. The gap doubles in roughly <strong>8 months</strong> at current pace.`;
  },
  competitor_closing: (lower, total) => {
    if (total === 0) return "";
    if (lower === total) return "Good news: you're ahead of every competitor in your local set today. The harder news: holding that position requires the same effort that built it.";
    if (lower === 0) return "Every competitor in your market is ahead of you on at least one dimension today. The good news: most of the gap closes in 90 days of consistent effort.";
    return `Good news: you're better than ${lower} of ${total} competitors in your area today. Harder news: by Q4, you'll be better than fewer if nothing changes.`;
  },
  actions: {
    result_label: "Result",
    owner_baam: "BAAM Review",
    owner_baam_platform: "BAAM Platform",
    owner_you: "You + Staff",
    value_12mo: "12-month value",
    reviews_per_year: "reviews/yr",
    customers: "customers",
    per_review_value_label: "per-review value",
    ltv_label: "lifetime value",
    post_visit: {
      title: "Activate a post-visit review request workflow",
      why: "Sending a request 24–72 hours after every visit, in the customer's language, is the single biggest lever in this audit.",
      result: (n) => `+${Math.round(n)} reviews / month`,
    },
    respond: {
      title: "Respond to every review within 48 hours · negatives within 24",
      why: "88% of consumers will choose a business that responds to all reviews vs. 47% for non-responders. Bilingual responses double the effect.",
      result: "+12% conversion lift",
    },
    profile: {
      title: "Complete every profile · revive dormant platforms",
      why: "Vertical-specific platforms (Healthgrades, Zocdoc, Avvo) and dormant Facebook signals all weaken Google's read on the health of your business.",
      result: "+15% local search reach",
    },
    recover: {
      title: (n) => `Recover the ${n} unanswered reviews`,
      why: "Personalized, AI-drafted, owner-approved responses to your historical reviews. Signals to Google and to future readers that you care — without faking it.",
      result: "+8% ranking signal",
    },
    widget: {
      title: "Embed live review widget on your website",
      why: "Reviews drive SEO; SEO drives traffic; traffic drives bookings. Same reviews working twice. Schema markup makes them eligible for Google rich results.",
      result: "+18% on-site conversion",
    },
  },
  appendix_vertical: {
    cafe: "Coffee / Café",
    salon_spa: "Salon / Spa",
    apparel: "Apparel / Boutique",
    health_food: "Health Food / Supplements",
    insurance: "Insurance Agent",
    tcm_clinic: "Acupuncture / Clinic / Dental",
    hotel: "Hotel / Resort",
    auto: "Auto Dealer / Repair",
    contractor: "Contractor / Roofing / HVAC",
    real_estate: "Real Estate Agent",
    legal_immigration: "Lawyer / Immigration",
  },
};

const ZH: LabelSet = {
  doc_header_subtitle: "聲譽與營收診斷報告 · v3.0",
  verticals: {
    tcm_clinic: "中醫診所",
    dental: "牙科診所",
    legal_immigration: "移民法律",
    restaurant: "餐廳",
    real_estate: "房地產",
    hotel: "酒店",
    auto: "汽車服務",
    contractor: "承包商",
    salon_spa: "美容沙龍",
    cafe: "咖啡館",
    apparel: "服飾店",
    health_food: "健康食品",
    insurance: "保險",
    general_smb: "本地商家",
  },
  grade_diagnoses: {
    A: "您在本地市場處於領先地位 · 評論已成為您的競爭護城河。",
    B: "表現強勁 · 但每月都在被頂級競爭對手追上。",
    C: "尚可被看見 · 但客戶正選擇評論更強的競爭對手。",
    D: "每週都在向評論更好的競爭對手流失客戶。",
    F: "幾乎完全隱形 · 搜尋與 AI 已不再顯示您。",
  },
  platforms: {
    google_name: "Google 商家檔案",
    google_meta: "主要平台 · 觸及 81% 消費者",
  },
  health: { verified: "已驗證", not_claimed: "未認領" },
  last_review: {
    never: "從未",
    today: "今天",
    yesterday: "昨天",
    one_month: "1 個月前",
    days: (n) => `${n} 天前`,
    months: (n) => `${n} 個月前`,
  },
  subscore_labels: {
    rating_quality: "評分品質",
    review_volume: "評論總數",
    velocity_30d: "近 30 天速率",
    velocity_180d: "近 6 個月速率",
    velocity_365d: "近 12 個月速率",
  },
  composite_prefix: "綜合",
  total_reviews_suffix: "則總評論",
  avg_suffix: "平均",
  footnotes: {
    rating: "Google 評分 · 付費版本納入其他平台",
    volume: "對比行業中位數",
  },
  insight_callout: ({ rating, count, days_ago, weakest }) => {
    const recent =
      days_ago == null
        ? "您的 Google 檔案目前尚無評論記錄。"
        : days_ago > 60
          ? `您最近一則 Google 評論在 ${days_ago} 天前 — 搜尋引擎與 AI 都會將沉默解讀為衰退。`
          : `您最近一則 Google 評論在 ${days_ago} 天前。`;
    const w =
      weakest === "velocity_30d"
        ? "最弱的環節是過去 30 天 — Google 演算法最密切關注的窗口。"
        : weakest === "review_volume"
          ? `總評論數 <strong>${count}</strong> 則低於您行業的中位數 — 評論總量是最弱項。`
          : weakest === "rating_quality"
            ? `綜合 ${rating.toFixed(2)} 星的評分是拖累您分數的主因。`
            : "最弱的環節是長期速率 — 持續累積才是關鍵槓桿。";
    return `<strong>這代表什麼</strong><br><br>${recent} ${w}`;
  },
  projection_floor: {
    same_grade: "分數暫時保持 · 但與頂級競爭對手的差距每個月都在擴大。",
    dropped: (from, to) =>
      `從 ${from} 級降至 ${to} 級 · 60 天無新評論將觸發臨界下限規則`,
  },
  ranking_hold: "排名持平",
  gauge: { silent: "沉睡", min: "最低", optimal: "理想" },
  velocity_pointer: (v) => `您 · ${v.toFixed(1)} 則/月`,
  money_on_table: ({ competitor_avg, you_avg, gap, annual_loss }) => {
    if (gap <= 0) {
      return `您的市場正在沉睡 — 競爭對手平均每月 <em>${competitor_avg.toFixed(1)} 則評論</em>，您為 <em>${you_avg.toFixed(1)}</em>。第一個持續累積評論的商家將完全勝出。`;
    }
    return `競爭對手平均每月收到 <em>${competitor_avg.toFixed(1)} 則評論</em>，您為 <em>${you_avg.toFixed(1)}</em>。<br><br>每月 ${gap.toFixed(1)} 則的差距，按您行業的中位每則評論價值計算，每年約損失 <strong>$${annual_loss.toLocaleString()}</strong> 的客戶終身價值。`;
  },
  you_tag: "您",
  competitor_diagnosis_empty:
    "您所在的審計範圍內沒有可比競爭對手 — 罕見的優勢。唯一的競爭來自不累積評論的您自己。",
  competitor_diagnosis: ({ top_name, top_velocity, you_velocity, multiple, per_review_value }) => {
    if (you_velocity >= top_velocity) {
      return `<strong>觀察</strong> 您在 30 天速率上超越市場所有競爭對手 — 這是您的護城河，請繼續維持。`;
    }
    const multStr = multiple > 1 ? `每月多 ${multiple.toFixed(1)} 倍的評論` : "更多的月評論";
    const perRev = `$${per_review_value.toLocaleString()}`;
    return `<strong>觀察</strong> ${top_name} 每月正在比您獲得 <strong>${multStr}</strong>。以每則評論 ${perRev} 計算，他們領先的每一個月都讓排名差距複利擴大。以目前速度估算，差距大約每 <strong>8 個月翻倍</strong>。`;
  },
  competitor_closing: (lower, total) => {
    if (total === 0) return "";
    if (lower === total) return "好消息：今天您領先本地集合中的每一個競爭對手。較難的消息：保住領先所需的努力與當初取得領先一樣多。";
    if (lower === 0) return "本地每個競爭對手都在至少一個維度上領先您。好消息：堅持 90 天的努力即可縮小大部分差距。";
    return `好消息：今天您勝過 ${total} 位競爭對手中的 ${lower} 位。較難的消息：若一切不變，到第四季度您將勝過更少。`;
  },
  actions: {
    result_label: "成效",
    owner_baam: "BAAM Review",
    owner_baam_platform: "BAAM Platform",
    owner_you: "您與員工",
    value_12mo: "12 個月價值",
    reviews_per_year: "則評論/年",
    customers: "位客戶",
    per_review_value_label: "每則評論價值",
    ltv_label: "客戶終身價值",
    post_visit: {
      title: "啟用就診後評論請求流程",
      why: "在每次就診後 24–72 小時內，以客戶的語言發送請求 — 這是本次審計中影響最大的單一槓桿。",
      result: (n) => `+${Math.round(n)} 則評論/月`,
    },
    respond: {
      title: "48 小時內回覆每則評論 · 負評 24 小時內",
      why: "88% 的消費者會選擇對所有評論都回覆的商家，而對未回覆者僅為 47%。雙語回覆讓效果倍增。",
      result: "+12% 轉化提升",
    },
    profile: {
      title: "完善每個平台檔案 · 重啟沉睡渠道",
      why: "Healthgrades、Zocdoc、Avvo 等行業專屬平台與沉睡的 Facebook 信號都會削弱 Google 對您商家活力的判讀。",
      result: "+15% 本地搜尋觸及",
    },
    recover: {
      title: (n) => `回覆過往 ${n} 則未回應評論`,
      why: "由 AI 草擬、店主審核並個性化的歷史評論回覆。同時向 Google 與未來讀者傳遞「您在乎」的訊號 — 無需任何作假。",
      result: "+8% 排名信號",
    },
    widget: {
      title: "在您的官網嵌入即時評論小工具",
      why: "評論帶動 SEO · SEO 帶動流量 · 流量帶動預約。同一批評論發揮兩次作用，加上 Schema 標記讓它們有機會出現在 Google 富媒體結果。",
      result: "+18% 網站轉化",
    },
  },
  appendix_vertical: {
    cafe: "咖啡 / 餐飲",
    salon_spa: "美容 / 水療",
    apparel: "服飾 / 精品",
    health_food: "健康食品 / 保健",
    insurance: "保險經紀",
    tcm_clinic: "針灸 / 中醫 / 牙科",
    hotel: "酒店 / 度假村",
    auto: "汽車經銷 / 維修",
    contractor: "承包商 / 屋頂 / 空調",
    real_estate: "房地產經紀",
    legal_immigration: "律師 / 移民",
  },
};

export const LABELS: Record<AuditLanguage, LabelSet> = { en: EN, zh: ZH };

export const STRINGS: Record<
  AuditLanguage,
  {
    page_label: (n: number, total: string) => string;
    cover_eyebrow: (pages: string) => string;
    cover_title_html: string;
    cover_subtitle: string;
    cover_meta_labels: { business: string; location: string; vertical: string; audit_id: string };
    cover_meta_subtitle: string;
    hook_quote_html: string;
    section_titles: Record<string, string>;
    section_headlines: Record<string, string>;
    section_decks: Record<string, string>;
    snapshot_table_headers: { platform: string; rating: string; reviews: string; last_review: string; health: string };
    paid_only_row: string;
    methodology_eyebrow: string;
    methodology_text_html: string;
    velocity_drag_line_html: string;
    forecast_eyebrow: string;
    projection_title_html: string;
    projection_deck: string;
    projection_legend_lines: string[];
    projection_impact_labels: { score: string; ranking: string; revenue: string };
    grade_scale_eyebrow: string;
    grade_scale_headline_html: (grade: string) => string;
    grade_scale_headers: { range: string; grade: string; meaning: string };
    grade_scale_table: Array<{ range: string; grade: string; meaning: string; class: string }>;
    upgrade_cta_section_num: string;
    upgrade_cta_title: string;
    upgrade_cta_headline_html: string;
    upgrade_cta_items: string[];
    upgrade_cta_closing: string;
    section_4_headline_html: string;
    section_4_deck: string;
    benchmark_panel_a_eyebrow: string;
    benchmark_panel_a_title_html: (vertical: string) => string;
    benchmark_panel_a_detail_html: (median: string, range: string) => string;
    benchmark_panel_a_methodology: string;
    benchmark_panel_b_eyebrow: string;
    benchmark_panel_b_title_html: string;
    benchmark_panel_b_detail_html: string;
    money_on_table_eyebrow: string;
    section_5_headline_html: string;
    section_5_deck: string;
    competitor_table_headers: { business: string; score: string; rating: string; total: string; last_30d: string; last_90d: string; trend: string };
    section_6_headline_html: string;
    section_6_deck: string;
    summary_block_html: (added: string, lost: string) => string;
    cta_eyebrow: string;
    cta_headline_html: string;
    cta_self: { label: string; title: string; price: string; desc: string };
    cta_full: { label: string; title: string; price: string; desc: string };
    cta_promise_html: string;
    appendix_section_title: string;
    appendix_section_headline_html: string;
    appendix_section_deck_html: string;
    appendix_a1_eyebrow: string;
    appendix_a1_title: string;
    appendix_a1_deck: string;
    appendix_a1_headers: { vertical: string; range: string; median: string };
    appendix_a2_eyebrow: string;
    appendix_a2_title: string;
    appendix_a2_deck: string;
    appendix_a2_headers: { vertical: string; minimum: string; optimal: string; aggressive: string };
    appendix_source_html: string;
    appendix_closing_quote_html: string;
    end_label: string;
  }
> = {
  en: {
    page_label: (n, total) => `Page ${String(n).padStart(2, "0")} / ${total}`,
    cover_eyebrow: (pages) => `A personalized diagnostic · ${pages} pages · for the owner, not the developer`,
    cover_title_html: "The reputation report you've been <em>missing.</em>",
    cover_subtitle: "Where your business stands today, what it costs you each month, and the five things to do in the next 12 months.",
    cover_meta_labels: { business: "Business", location: "Location", vertical: "Vertical", audit_id: "Audit ID" },
    cover_meta_subtitle: "prepared by BAAM Studio",
    hook_quote_html: "Average businesses become <em>hot and popular</em> by building reviews relentlessly.<br>Excellent businesses become <em>invisible</em> because they ignore them.",
    section_titles: {
      "01": "Why Reviews Decide Who Wins",
      "02": "Your Current Snapshot",
      "03": "Your BAAM Review Score",
      "04": "Industry Benchmarks",
      "05": "Competitor Comparison",
      "06": "Your 12-Month Action Plan",
      "A": "Appendix · Reference Tables",
    },
    section_headlines: {
      "01": "The rules of getting found <em>changed.</em>",
      "02": "Where customers <em>actually look</em> for you.",
    },
    section_decks: {
      "01": "Five things that are now true about local search — each measured, each cited, none arguable.",
      "02": "Free tier covers Google — by itself ~81% of local consumer reach. The paid audit adds Yelp, Facebook, Zocdoc, Healthgrades.",
    },
    snapshot_table_headers: { platform: "Platform", rating: "Rating", reviews: "Reviews", last_review: "Last Review", health: "Profile Health" },
    paid_only_row: "Yelp · Facebook · Zocdoc · Healthgrades — included in the paid audit.",
    methodology_eyebrow: "METHODOLOGY",
    methodology_text_html: "Every score is measured against published vertical benchmarks. <strong>Rating Quality</strong> uses a non-linear curve that rewards the 4.0★ threshold (where 70% of consumers filter). <strong>Review Volume</strong> compares total count to the median for your vertical. <strong>Velocity</strong> scores use BAAM Review Research healthy-pace bands. The black tick marks on each bar show where these standards sit on the 0–100 scale. <a href=\"https://www.baamreview.com/review-value.html\" target=\"_blank\">Full methodology →</a>",
    velocity_drag_line_html: "The drag on your score is <em style=\"color: var(--rust-deep);\">velocity</em> — and velocity is what you can change starting Monday.",
    forecast_eyebrow: "§ 03.5 · The Forecast",
    projection_title_html: "Your score in <em>six months</em> if you do nothing.",
    projection_deck: "Three forces work against a business that stops collecting reviews: velocity decay (mechanical), ranking decline (Sterling Sky), and competitors compounding the gap. This projection holds your current effort constant — and holds your competitors at their measured pace.",
    projection_legend_lines: [
      "<span class=\"legend-swatch red\"></span> <strong>Do nothing</strong> · projected trajectory at current effort",
      "<span class=\"legend-swatch green\"></span> <strong>With BAAM Review</strong> · sustained collection + response",
    ],
    projection_impact_labels: { score: "6-Month Score", ranking: "Ranking Position", revenue: "Revenue Cost" },
    grade_scale_eyebrow: "The full scale · where each grade sits",
    grade_scale_headline_html: (g) => `Your <em>${g}</em> in context — and what it would take to climb.`,
    grade_scale_headers: { range: "Score Range", grade: "Grade", meaning: "What it means in plain English" },
    grade_scale_table: [
      { range: "90 – 100", grade: "A", meaning: EN.grade_diagnoses.A, class: "g-a" },
      { range: "75 – 89", grade: "B", meaning: EN.grade_diagnoses.B, class: "g-b" },
      { range: "60 – 74", grade: "C", meaning: EN.grade_diagnoses.C, class: "g-c" },
      { range: "40 – 59", grade: "D", meaning: EN.grade_diagnoses.D, class: "g-d" },
      { range: "0 – 39", grade: "F", meaning: EN.grade_diagnoses.F, class: "g-f" },
    ],
    upgrade_cta_section_num: "§ 04+",
    upgrade_cta_title: "What the paid audit unlocks",
    upgrade_cta_headline_html: "You've seen <em>where you stand.</em><br>Now see what it costs — and what to do.",
    upgrade_cta_items: [
      "<strong>Section 4 · Industry Benchmarks</strong> — your vertical's per-review dollar value, healthy velocity bands, what \"top 25%\" actually looks like.",
      "<strong>Section 5 · Competitor Comparison</strong> — your 5 closest competitors, side-by-side, with the gap quantified.",
      "<strong>Section 6 · 12-Month Action Plan</strong> — five concrete moves, ranked by impact, with the dollar value of each.",
      "<strong>Sections 1–3 · Multi-platform extension</strong> — Yelp, Facebook, Zocdoc, Healthgrades scoring blended in.",
      "<strong>Section 7 · Appendix</strong> — the full reference tables.",
    ],
    upgrade_cta_closing: "Every grade you saw in this report is honest about the data we had.<br>The paid audit shows you the full picture.",
    section_4_headline_html: "Translated into <em>dollars</em> and <em>customers.</em>",
    section_4_deck: "Numbers from the BAAM Review Research brief, applied to your specific category.",
    benchmark_panel_a_eyebrow: "§ 04A · Per-Review Dollar Value",
    benchmark_panel_a_title_html: (v) => `One strong Google review is worth, for a ${v}…`,
    benchmark_panel_a_detail_html: (median, range) =>
      `Value compounds across three channels — Google search ranking, on-site widget trust, and friend-to-friend referral. The median per-review value for your vertical is <strong>${median}</strong>, with a typical range of <strong>${range}</strong>.`,
    benchmark_panel_a_methodology: "Methodology: baamreview.com/review-value.html",
    benchmark_panel_b_eyebrow: "§ 04B · Healthy Velocity Range",
    benchmark_panel_b_title_html: "A business in this vertical should be collecting…",
    benchmark_panel_b_detail_html:
      "Per BrightLocal, only <strong>9% of businesses</strong> sustain the Optimal pace — the band Google's ranking algorithm actually rewards.",
    money_on_table_eyebrow: "§ The Money on the Table",
    section_5_headline_html: "The names customers <em>see before yours.</em>",
    section_5_deck: "Identified from Google Maps rankings within your search radius. We pick the competitors — owners almost always pick the wrong ones.",
    competitor_table_headers: { business: "Business", score: "Score", rating: "Rating", total: "Total Reviews", last_30d: "Last 30d", last_90d: "Last 90d", trend: "Trend" },
    section_6_headline_html: "Five things. <em>Not three. Not ten.</em>",
    section_6_deck: "Prioritized by the lowest sub-scores in your audit. Each action targets a specific lever — and a specific dollar number.",
    summary_block_html: (added, lost) =>
      `Five actions, executed steadily for 12 months, modeled at <strong style=\"font-family:'JetBrains Mono', monospace; font-style: normal; font-weight: 500;\">${added}</strong> in additional lifetime customer value — versus a projected loss of <strong style=\"font-family:'JetBrains Mono', monospace; font-style: normal; font-weight: 500;\">${lost}</strong> if nothing changes.`,
    cta_eyebrow: "Two paths · same plan",
    cta_headline_html: "You don't have to do this <em>alone.</em>",
    cta_self: {
      label: "Path A · Self-Serve",
      title: "Run it yourself",
      price: "$99 / month · single location · 30-day free trial",
      desc: "Log in, send your weekly review requests, reply yourself. You drive the system; BAAM Review provides the platform, AI drafting, and multilingual templates.",
    },
    cta_full: {
      label: "Path B · Full Service",
      title: "We run it for you",
      price: "$399 / month · 30-day free trial · 5× value promise",
      desc: "Send us your weekly customer list. We handle every other step — bilingual sends, AI-assisted responses, monthly reports, the 12-month plan above. We guarantee 5× the value within 12 months.",
    },
    cta_promise_html: "Compare with <strong>Birdeye</strong> at $299/mo + $5,000 setup, or <strong>Podium</strong> at $399/mo + onboarding. BAAM Review starts free and bills monthly.",
    appendix_section_title: "Appendix · Reference Tables",
    appendix_section_headline_html: "The full methodology, <em>in two tables.</em>",
    appendix_section_deck_html: "Every number in this audit traces to one of the standards below. Your vertical is highlighted. The complete research brief lives at <a href=\"https://www.baamreview.com/review-value.html\" target=\"_blank\">baamreview.com/review-value.html</a>.",
    appendix_a1_eyebrow: "§ A.1 · Industry Per-Review Value",
    appendix_a1_title: "Per-Review Dollar Value, by Vertical",
    appendix_a1_deck: "Modeled value of one strong Google review over a 24-month horizon.",
    appendix_a1_headers: { vertical: "Vertical", range: "Per-Review Value", median: "Median" },
    appendix_a2_eyebrow: "§ A.2 · Healthy Velocity Standards",
    appendix_a2_title: "Reviews Per Month, by Vertical",
    appendix_a2_deck: "The pace bands Google's local ranking algorithm actually rewards. Only 9% of businesses sustain the Optimal range.",
    appendix_a2_headers: { vertical: "Vertical", minimum: "Minimum", optimal: "Optimal", aggressive: "Aggressive" },
    appendix_source_html: "Sources · Harvard Business School · BrightLocal · Whitespark · NYU Stern · Federal Trade Commission · Google Transparency Report",
    appendix_closing_quote_html: "\"Reviews are not the end goal. They are the <em style=\"color: var(--rust-deep);\">raw material</em> for trust, content, SEO, referrals, and revenue.\"",
    end_label: "End",
  },
  zh: {
    page_label: (n, total) => `第 ${String(n).padStart(2, "0")} 頁 / 共 ${total} 頁`,
    cover_eyebrow: (pages) => `為您量身定制的診斷報告 · 共 ${pages} 頁 · 為老闆而寫，非為工程師`,
    cover_title_html: "您一直缺少的那份<em>聲譽報告</em>",
    cover_subtitle: "您的業務當前狀況、每月損失多少、以及未來 12 個月需要採取的五項行動",
    cover_meta_labels: { business: "商家", location: "地址", vertical: "行業", audit_id: "審計編號" },
    cover_meta_subtitle: "由 BAAM Studio 編製",
    hook_quote_html: "普通的企業因勤於累積評論而<em>蒸蒸日上</em>，<br>卓越的企業卻因忽視評論而<em>逐漸沉寂</em>。",
    section_titles: {
      "01": "為何評論決定誰能勝出",
      "02": "您目前的狀況概覽",
      "03": "您的 BAAM 評論評分",
      "04": "行業基準",
      "05": "競爭對手比較",
      "06": "您的 12 個月行動計劃",
      "A": "附錄 · 參考數據表",
    },
    section_headlines: {
      "01": "被客戶找到的規則 · <em>已經改變了</em>",
      "02": "客戶<em>實際在哪裡</em>查找您",
    },
    section_decks: {
      "01": "關於本地搜索，現在有五件事實 — 每項都有測量數據、每項都有出處引用、無一可以爭辯。",
      "02": "免費版本涵蓋 Google · 約佔本地消費者觸及的 81%。付費版本加入 Yelp · Facebook · Zocdoc · Healthgrades。",
    },
    snapshot_table_headers: { platform: "平台", rating: "評分", reviews: "評論數", last_review: "最新評論", health: "檔案健康度" },
    paid_only_row: "Yelp · Facebook · Zocdoc · Healthgrades — 包含於付費審計版本。",
    methodology_eyebrow: "方法說明",
    methodology_text_html: "每項分數均對照已發布的行業基準衡量。<strong>評分品質</strong>使用非線性曲線，重點獎勵 4.0 星門檻（70% 消費者以此篩選）。<strong>評論總數</strong>對比您行業的中位數。<strong>速率</strong>使用 BAAM Review 研究的健康節奏帶。每根柱上的黑色刻度標示這些標準在 0–100 分尺上的位置。<a href=\"https://www.baamreview.com/review-value.html\" target=\"_blank\">完整方法 →</a>",
    velocity_drag_line_html: "拖累您分數的是<em style=\"color: var(--rust-deep);\">速率</em> — 而速率正是您下週一就可以開始改變的環節。",
    forecast_eyebrow: "§ 03.5 · 預測",
    projection_title_html: "若您什麼都不做 · <em>六個月後的分數</em>",
    projection_deck: "停止累積評論的商家會面對三股力量：速率機械性衰減、排名下滑（Sterling Sky 研究）、競爭對手持續複利擴大差距。本預測假設您維持當前努力，競爭對手維持已測得的速率。",
    projection_legend_lines: [
      "<span class=\"legend-swatch red\"></span> <strong>什麼都不做</strong> · 依現有努力的預測軌跡",
      "<span class=\"legend-swatch green\"></span> <strong>使用 BAAM Review</strong> · 持續收集與回覆",
    ],
    projection_impact_labels: { score: "6 個月後分數", ranking: "排名位置", revenue: "營收損失" },
    grade_scale_eyebrow: "完整等級表 · 每個等級的意義",
    grade_scale_headline_html: (g) => `您的 <em>${g}</em> 級在整體中的位置 · 以及更上一層需要什麼。`,
    grade_scale_headers: { range: "分數區間", grade: "等級", meaning: "白話說明" },
    grade_scale_table: [
      { range: "90 – 100", grade: "A", meaning: ZH.grade_diagnoses.A, class: "g-a" },
      { range: "75 – 89", grade: "B", meaning: ZH.grade_diagnoses.B, class: "g-b" },
      { range: "60 – 74", grade: "C", meaning: ZH.grade_diagnoses.C, class: "g-c" },
      { range: "40 – 59", grade: "D", meaning: ZH.grade_diagnoses.D, class: "g-d" },
      { range: "0 – 39", grade: "F", meaning: ZH.grade_diagnoses.F, class: "g-f" },
    ],
    upgrade_cta_section_num: "§ 04+",
    upgrade_cta_title: "付費審計解鎖的內容",
    upgrade_cta_headline_html: "您已看見<em>自己目前的位置</em>。<br>付費版本告訴您損失多少 · 該怎麼做。",
    upgrade_cta_items: [
      "<strong>第 4 章 · 行業基準</strong> — 您行業每則評論的美元價值、健康速率帶、「前 25%」實際的樣貌。",
      "<strong>第 5 章 · 競爭對手比較</strong> — 您最近的 5 位競爭對手並排展示，量化差距。",
      "<strong>第 6 章 · 12 個月行動計劃</strong> — 五項具體行動，按影響排序，每項都有明確的美元價值。",
      "<strong>第 1–3 章 · 多平台擴展</strong> — Yelp、Facebook、Zocdoc、Healthgrades 評分一併納入。",
      "<strong>第 7 章 · 附錄</strong> — 完整的參考數據表。",
    ],
    upgrade_cta_closing: "本報告中的每個等級都根據我們所有的數據誠實呈現。<br>付費版本展示完整全貌。",
    section_4_headline_html: "轉化為<em>美元</em>與<em>客戶</em>",
    section_4_deck: "BAAM Review 研究報告中的數據，套用到您的具體行業。",
    benchmark_panel_a_eyebrow: "§ 04A · 每則評論的美元價值",
    benchmark_panel_a_title_html: (v) => `對於${v}，一則強而有力的 Google 評論值多少…`,
    benchmark_panel_a_detail_html: (median, range) =>
      `價值在三個渠道上複利累積 — Google 搜尋排名、官網小工具的信任度、口耳相傳的轉介。對您行業而言，每則評論的中位數價值為 <strong>${median}</strong>，典型區間 <strong>${range}</strong>。`,
    benchmark_panel_a_methodology: "方法說明：baamreview.com/review-value.html",
    benchmark_panel_b_eyebrow: "§ 04B · 健康速率區間",
    benchmark_panel_b_title_html: "您行業的商家每月應該累積…",
    benchmark_panel_b_detail_html:
      "根據 BrightLocal · 只有 <strong>9% 的商家</strong>能維持理想速率 — 也就是 Google 排名演算法真正獎勵的區間。",
    money_on_table_eyebrow: "§ 桌上未取的金錢",
    section_5_headline_html: "客戶<em>在看見您之前先看見的</em>對手",
    section_5_deck: "由 Google Maps 在您的搜尋半徑內排名識別。我們替您挑選競爭對手 — 店主自己挑往往挑錯。",
    competitor_table_headers: { business: "商家", score: "分數", rating: "評分", total: "總評論", last_30d: "近 30 天", last_90d: "近 90 天", trend: "趨勢" },
    section_6_headline_html: "五件事 · <em>不是三件，不是十件</em>",
    section_6_deck: "依您審計中最低的子分數排序。每項行動都針對特定的槓桿 — 與具體的美元數字。",
    summary_block_html: (added, lost) =>
      `穩定執行五項行動 12 個月，預計帶來 <strong style=\"font-family:'JetBrains Mono', monospace; font-style: normal; font-weight: 500;\">${added}</strong> 的額外客戶終身價值 — 對比若什麼都不做，預計損失 <strong style=\"font-family:'JetBrains Mono', monospace; font-style: normal; font-weight: 500;\">${lost}</strong>。`,
    cta_eyebrow: "兩條路徑 · 同一個計劃",
    cta_headline_html: "您不需要<em>獨自完成這一切</em>",
    cta_self: {
      label: "路徑 A · 自助方案",
      title: "您自己執行",
      price: "$99 / 月 · 單店 · 30 天免費試用",
      desc: "登入系統，每週發送評論請求並親自回覆。您主導流程 · BAAM Review 提供平台、AI 草擬與多語言範本。",
    },
    cta_full: {
      label: "路徑 B · 全託管方案",
      title: "由我們替您執行",
      price: "$399 / 月 · 30 天免費試用 · 5 倍價值承諾",
      desc: "每週寄給我們客戶名單，其他全部由我們處理 — 雙語發送、AI 輔助回覆、每月報告、上述 12 個月計劃。我們承諾 12 個月內帶來 5 倍價值。",
    },
    cta_promise_html: "對比 <strong>Birdeye</strong> 每月 $299 + $5,000 開通費，或 <strong>Podium</strong> 每月 $399 + 入駐流程。BAAM Review 免費起步，按月計費。",
    appendix_section_title: "附錄 · 參考數據表",
    appendix_section_headline_html: "完整方法 · <em>濃縮在兩張表</em>",
    appendix_section_deck_html: "本審計中的每個數字都可追溯到下方標準之一，您的行業已標示。完整研究報告於 <a href=\"https://www.baamreview.com/review-value.html\" target=\"_blank\">baamreview.com/review-value.html</a>。",
    appendix_a1_eyebrow: "§ A.1 · 各行業每則評論價值",
    appendix_a1_title: "每則評論的美元價值 · 按行業分類",
    appendix_a1_deck: "一則強 Google 評論在 24 個月內的建模價值。",
    appendix_a1_headers: { vertical: "行業", range: "每則評論價值", median: "中位數" },
    appendix_a2_eyebrow: "§ A.2 · 健康速率標準",
    appendix_a2_title: "每月評論數 · 按行業分類",
    appendix_a2_deck: "Google 本地排名演算法真正獎勵的節奏帶。只有 9% 的商家能持續維持理想範圍。",
    appendix_a2_headers: { vertical: "行業", minimum: "最低", optimal: "理想", aggressive: "進取" },
    appendix_source_html: "資料來源 · 哈佛商學院 · BrightLocal · Whitespark · 紐約大學斯特恩商學院 · 美國聯邦貿易委員會 · Google 透明度報告",
    appendix_closing_quote_html: "「評論不是最終目標 · 它們是信任、內容、SEO、轉介與營收的<em style=\"color: var(--rust-deep);\">原材料</em>」",
    end_label: "完",
  },
};
