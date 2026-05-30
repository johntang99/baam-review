import { getGoogleBusinessData } from "@/lib/audit/google";

async function main() {
  const arg = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tierArg = (process.argv[3] ?? "free") as "free" | "paid";
  const isPlaceId = arg.startsWith("ChIJ") || arg.startsWith("EhI");

  console.log(`\n>> Fetching tier=${tierArg} for ${isPlaceId ? `placeId=${arg}` : `query="${arg}"`}\n`);

  const t0 = Date.now();
  const result = await getGoogleBusinessData(
    isPlaceId ? { placeId: arg } : { textQuery: arg },
    tierArg,
  );
  const ms = Date.now() - t0;

  console.log(`Fetched in ${ms}ms (cache_hit=${result.meta.cache_hit})\n`);
  console.log("business:", {
    name: result.business.name,
    name_secondary: result.business.name_secondary,
    address: result.business.formatted_address,
    phone: result.business.phone,
    website: result.business.website,
  });
  console.log("vertical:", result.vertical);
  console.log("language:", result.language);
  console.log("profile_health:", result.profile_health);
  console.log("reviews_aggregate:", result.reviews_aggregate);
  console.log("review count returned:", result.reviews.length);
  console.log("first review sample:", result.reviews[0] ? {
    author: result.reviews[0].author_name,
    rating: result.reviews[0].rating,
    lang: result.reviews[0].language,
    text_preview: result.reviews[0].text.slice(0, 80),
    has_owner_response: result.reviews[0].has_owner_response,
    response_time_hours: result.reviews[0].owner_response_time_hours,
  } : null);
  console.log("meta:", result.meta);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
