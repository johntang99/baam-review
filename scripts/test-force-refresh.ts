import { getGoogleBusinessData } from "@/lib/audit/google";

(async () => {
  const r = await getGoogleBusinessData(
    { placeId: "ChIJedSLGABhwokRFeP5JVIZOSM", forceRefresh: true },
    "paid",
  );
  console.log("after refresh:", {
    data_source: r.meta.data_source,
    degraded: r.meta.degraded,
    reviews_30d: r.reviews_aggregate.reviews_30d,
    response_rate: r.reviews_aggregate.response_rate,
  });

  const r2 = await getGoogleBusinessData(
    { placeId: "ChIJedSLGABhwokRFeP5JVIZOSM" },
    "paid",
  );
  console.log("cache check after good fetch:", {
    cache_hit: r2.meta.cache_hit,
    data_source: r2.meta.data_source,
    reviews_30d: r2.reviews_aggregate.reviews_30d,
  });
})();
