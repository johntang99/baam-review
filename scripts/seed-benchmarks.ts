import { buildSeedBenchmarks } from "@/lib/audit/benchmarks/seed-data";
import { seedBenchmarks } from "@/lib/audit/benchmarks/benchmark-client";

(async () => {
  const benchmarks = buildSeedBenchmarks();
  console.log(`Seeding ${benchmarks.length} benchmarks (v1.0.0, national)...`);
  await seedBenchmarks(benchmarks);
  console.log("Done.");
  for (const b of benchmarks) {
    const v = b.healthy_velocity;
    console.log(
      `  ${b.vertical.padEnd(22)} median=$${b.per_review_value.median_usd.toString().padStart(5)} | min=${v.minimum_per_month}/mo opt=${v.optimal_low_per_month}-${v.optimal_high_per_month}/mo agg=${v.aggressive_per_month}/mo`,
    );
  }
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
