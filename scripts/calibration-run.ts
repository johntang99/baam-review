import fs from "node:fs";
import path from "node:path";
import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore, logScoreRun } from "@/lib/audit/scoring";

const SEED: Array<{ query: string }> = [
  { query: "Datang Moxibustion Flushing NY" },
  { query: "Bill Jiao Acupuncture Flushing NY" },
  { query: "HRT Best Acupuncture Flushing NY" },
  { query: "Regen Acupuncture PC Flushing NY" },
  { query: "Fay Acupuncture Herbal Medicine Flushing NY" },
  { query: "Natural Life Acupuncture Flushing NY" },
  { query: "Wholesome Acupuncture Center Flushing NY" },
  { query: "Mindfulness Acupuncture Flushing NY" },

  { query: "dental clinic Flushing NY" },
  { query: "orthodontics Flushing NY" },
  { query: "Smile Dental Flushing NY" },

  { query: "Joe's Shanghai Flushing NY" },
  { query: "Xi'an Famous Foods Flushing NY" },
  { query: "Chen Du Tian Fu Flushing NY" },

  { query: "immigration lawyer Flushing NY" },
  { query: "law office Flushing NY" },

  { query: "hair salon Flushing NY" },
  { query: "beauty salon Flushing NY" },

  { query: "Sheraton LaGuardia Flushing NY" },
  { query: "auto repair Flushing NY" },
];

interface RunResult {
  query: string;
  ok: boolean;
  error?: string;
  place_id?: string;
  business_name?: string;
  vertical?: string;
  total_count?: number;
  rating?: number;
  last_review_days_ago?: number | null;
  velocity_30d?: number | null;
  reviews_30d?: number | null;
  total_score?: number;
  grade?: string;
  rating_score?: number;
  volume_score?: number;
  velocity_30d_score?: number;
  critical_floor?: boolean;
  competitor_count?: number;
  competitor_avg_velocity?: number | null;
  is_chinese_business?: boolean;
}

(async () => {
  console.log(`>> Calibration run: ${SEED.length} businesses, free tier\n`);
  const t0 = Date.now();

  const results: RunResult[] = [];

  for (const [idx, seed] of SEED.entries()) {
    const label = `[${(idx + 1).toString().padStart(2, "0")}/${SEED.length}]`;
    process.stdout.write(`${label} ${seed.query.padEnd(50)} `);

    try {
      const google = await getGoogleBusinessData({ textQuery: seed.query }, "free");
      const competitors = await getCompetitorsData(google, "free");
      const benchmarks = await getBenchmarksForBusiness(google);
      const score = computeAuditScore(google, competitors, benchmarks);
      await logScoreRun(google, benchmarks, score).catch(() => {});

      const row: RunResult = {
        query: seed.query,
        ok: true,
        place_id: google.business.place_id,
        business_name: google.business.name,
        vertical: google.vertical.inferred_vertical,
        total_count: google.reviews_aggregate.total_count,
        rating: google.reviews_aggregate.rating,
        last_review_days_ago: google.reviews_aggregate.last_review_days_ago,
        velocity_30d: google.reviews_aggregate.velocity_30d_per_month,
        reviews_30d: google.reviews_aggregate.reviews_30d,
        total_score: score.total,
        grade: score.grade,
        rating_score: score.components.rating_quality.raw_score,
        volume_score: score.components.review_volume.raw_score,
        velocity_30d_score: score.components.velocity_30d.raw_score,
        critical_floor: score.critical_floor_applied,
        competitor_count: competitors.competitors.length,
        competitor_avg_velocity: competitors.competitor_aggregate.avg_velocity_30d_per_month,
        is_chinese_business: google.language.is_chinese_business,
      };
      results.push(row);
      console.log(`→ ${score.total}/${score.grade}  ${google.vertical.inferred_vertical}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ query: seed.query, ok: false, error: msg });
      console.log(`✗ ${msg}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s\n`);

  const outDir = path.join(process.cwd(), "audit/output");
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, "calibration-results.csv");
  fs.writeFileSync(csvPath, toCsv(results));
  console.log(`CSV: ${csvPath}`);

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`\nSucceeded: ${ok.length} · Failed: ${failed.length}`);

  if (ok.length > 0) {
    console.log("\n=== Score distribution ===");
    const grades: Record<string, number> = {};
    for (const r of ok) grades[r.grade!] = (grades[r.grade!] ?? 0) + 1;
    for (const g of ["A", "B", "C", "D", "F"]) {
      const n = grades[g] ?? 0;
      const bar = "█".repeat(n);
      console.log(`  ${g}  ${String(n).padStart(2)}  ${bar}`);
    }

    const totals = ok.map((r) => r.total_score!).sort((a, b) => a - b);
    console.log(`\n  total: min=${totals[0]} median=${totals[Math.floor(totals.length / 2)]} max=${totals[totals.length - 1]}`);
    console.log(`  critical floor activated: ${ok.filter((r) => r.critical_floor).length}/${ok.length}`);

    console.log("\n=== By vertical ===");
    const byVertical = groupBy(ok, (r) => r.vertical!);
    for (const [vertical, rows] of Object.entries(byVertical)) {
      const n = rows.length;
      const totalsV = rows.map((r) => r.total_score!).sort((a, b) => a - b);
      const countsV = rows.map((r) => r.total_count!).sort((a, b) => a - b);
      const ratingsV = rows.map((r) => r.rating!).sort((a, b) => a - b);
      const v30sV = rows.map((r) => r.velocity_30d ?? 0).sort((a, b) => a - b);
      const compV = rows.map((r) => r.competitor_avg_velocity ?? 0).sort((a, b) => a - b);

      console.log(`\n  ${vertical} (n=${n})`);
      console.log(`    score: ${pct(totalsV)}`);
      console.log(`    rating: ${pctF(ratingsV)}`);
      console.log(`    review_count: ${pct(countsV)}`);
      console.log(`    velocity_30d: ${pctF(v30sV)}`);
      console.log(`    competitor_avg_velocity: ${pctF(compV)}`);
    }

    console.log("\n=== Chinese-business detection ===");
    const zhCount = ok.filter((r) => r.is_chinese_business).length;
    console.log(`  ${zhCount}/${ok.length} detected as Chinese (auto-bilingual delivery)`);
  }

  if (failed.length > 0) {
    console.log("\n=== Failures ===");
    for (const f of failed) console.log(`  ${f.query} — ${f.error}`);
  }
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

function pct(sorted: number[]): string {
  const p = (q: number) => sorted[Math.floor((sorted.length - 1) * q)];
  return `p10=${p(0.1)} median=${p(0.5)} p90=${p(0.9)} max=${sorted[sorted.length - 1]}`;
}

function pctF(sorted: number[]): string {
  const p = (q: number) => sorted[Math.floor((sorted.length - 1) * q)].toFixed(2);
  return `p10=${p(0.1)} median=${p(0.5)} p90=${p(0.9)} max=${sorted[sorted.length - 1].toFixed(2)}`;
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

function toCsv(results: RunResult[]): string {
  const headers = [
    "query", "ok", "error", "place_id", "business_name", "vertical",
    "total_count", "rating", "last_review_days_ago", "velocity_30d",
    "reviews_30d", "total_score", "grade", "rating_score", "volume_score",
    "velocity_30d_score", "critical_floor", "competitor_count",
    "competitor_avg_velocity", "is_chinese_business",
  ];
  const rows = results.map((r) =>
    headers
      .map((h) => {
        const v = (r as unknown as Record<string, unknown>)[h];
        if (v == null) return "";
        const s = String(v);
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
