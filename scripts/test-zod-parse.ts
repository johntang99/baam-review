import { createServiceClient } from "@/lib/supabase/service";
import { AuditGoogleDataSchema } from "@/lib/audit/google/types";

(async () => {
  const supabase = createServiceClient();
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { data: unknown } | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  })
    .from("audit_business_data")
    .select("data")
    .eq("place_id", "ChIJedSLGABhwokRFeP5JVIZOSM")
    .eq("tier", "paid")
    .maybeSingle();

  if (error || !data) {
    console.log("no row:", error);
    return;
  }

  const parsed = AuditGoogleDataSchema.safeParse(data.data);
  if (parsed.success) {
    console.log("PARSE OK");
  } else {
    console.log("PARSE FAILED:");
    console.log(JSON.stringify(parsed.error.issues.slice(0, 5), null, 2));
  }
})();
