import { getGoogleBusinessData } from "@/lib/audit/google";
import { getAllPlatformsData } from "@/lib/audit/platforms";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "paid") as "free" | "paid";

  console.log(`>> Yelp test: placeId=${placeId} tier=${tier}\n`);

  const google = await getGoogleBusinessData({ placeId }, tier);
  console.log(`Business: ${google.business.name}`);
  console.log(`  ${google.business.formatted_address}`);
  console.log(`  vertical=${google.vertical.inferred_vertical}\n`);

  const t0 = Date.now();
  const platforms = await getAllPlatformsData(google, tier);
  const ms = Date.now() - t0;

  console.log(`Platforms fetched in ${ms}ms`);
  console.log("  attempted:", platforms.meta.platforms_attempted);
  console.log("  succeeded:", platforms.meta.platforms_succeeded);
  console.log("  not_found:", platforms.meta.platforms_not_found);
  console.log("  errored: ", platforms.meta.platforms_errored);
  console.log();

  if (platforms.yelp) {
    console.log(`Yelp profile: ${platforms.yelp.business_name_on_platform}`);
    console.log(`  URL: ${platforms.yelp.platform_url}`);
    console.log(`  Rating: ${platforms.yelp.rating ?? "—"}`);
    console.log(`  Reviews: ${platforms.yelp.total_count}`);
    console.log(`  Last review: ${platforms.yelp.last_review_days_ago != null ? platforms.yelp.last_review_days_ago + " days ago" : "never"}`);
    if (platforms.yelp.reviews.length > 0) {
      const r = platforms.yelp.reviews[0];
      console.log(`  Sample review: ${r.author_name} (${r.rating}★) — "${r.text.slice(0, 80)}..."`);
    }
  } else {
    console.log("Yelp: not found");
  }
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
