import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "free") as "free" | "paid";

  console.log(`>> Loading primary for placeId=${placeId} (tier=${tier})`);
  const primary = await getGoogleBusinessData(
    { placeId, forceRefresh: true },
    tier,
  );

  console.log(
    `\n>> Primary: ${primary.business.name}`,
    `\n   vertical=${primary.vertical.inferred_vertical}`,
    `\n   lat/lng=${primary.business.lat},${primary.business.lng}`,
    `\n   zip=${primary.business.zip}`,
    `\n   reviews=${primary.reviews_aggregate.total_count}, 30d=${primary.reviews_aggregate.reviews_30d}`,
  );

  console.log("\n>> Fetching competitors...");
  const t0 = Date.now();
  const result = await getCompetitorsData(primary, tier);
  const ms = Date.now() - t0;
  console.log(`Done in ${ms}ms (${result.meta.total_api_calls} API calls, ~$${result.meta.estimated_cost_usd.toFixed(3)})\n`);

  console.log("search_metadata:", result.search_metadata);
  console.log("competitor_aggregate:", result.competitor_aggregate);
  console.log(`\ncompetitors (${result.competitors.length}):`);
  for (const c of result.competitors) {
    console.log(
      `  #${c.rank}  ${c.google.business.name}`,
      `\n        dist=${c.distance_miles?.toFixed(2)}mi`,
      `rating=${c.google.reviews_aggregate.rating}`,
      `reviews=${c.google.reviews_aggregate.total_count}`,
      `30d=${c.google.reviews_aggregate.reviews_30d}`,
      `vel/mo=${c.google.reviews_aggregate.velocity_30d_per_month}`,
    );
  }
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
