import { createServiceClient } from "@/lib/supabase/service";

(async () => {
  const supabase = createServiceClient();
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .from("audit_score_runs")
    .select("computed_at,vertical,business_place_id,total_score,grade,critical_floor_applied,rating_quality_score,review_volume_score,velocity_30d_score,velocity_180d_score,velocity_365d_score")
    .order("computed_at", { ascending: false })
    .limit(3);

  console.log("Recent score runs:", JSON.stringify(data, null, 2));
  if (error) console.log("error:", error);
})();
