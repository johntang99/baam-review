import { createServiceClient } from "@/lib/supabase/service";

(async () => {
  const supabase = createServiceClient();
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{
            data: Array<{ place_id: string; tier: string; data_source: string; fetched_at: string; expires_at: string }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_business_data")
    .select("place_id,tier,data_source,fetched_at,expires_at")
    .eq("place_id", "ChIJedSLGABhwokRFeP5JVIZOSM")
    .eq("tier", "paid");

  console.log("rows:", data);
  console.log("error:", error);
})();
