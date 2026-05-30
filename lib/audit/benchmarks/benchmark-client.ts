import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  VerticalBenchmarksSchema,
  type RegionKey,
  type VerticalBenchmarks,
} from "./types";
import type { VerticalKey } from "../google/types";
import { BenchmarkNotFoundError } from "./errors";

const TABLE = "vertical_benchmarks";

function untypedFrom(supabase: ReturnType<typeof createServiceClient>) {
  return (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: boolean) => {
              maybeSingle: () => Promise<{
                data: { data: unknown; version: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      upsert: (
        row: unknown,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  }).from(TABLE);
}

export async function fetchActiveBenchmark(
  vertical: VerticalKey,
  region: RegionKey,
): Promise<VerticalBenchmarks> {
  const supabase = createServiceClient();

  const regional = await untypedFrom(supabase)
    .select("data,version")
    .eq("vertical", vertical)
    .eq("region", region)
    .eq("is_active", true)
    .maybeSingle();

  if (regional.error) {
    throw new Error(`benchmark read failed: ${regional.error.message}`);
  }

  if (regional.data) {
    const parsed = VerticalBenchmarksSchema.parse(regional.data.data);
    return parsed;
  }

  if (region !== "national") {
    const national = await untypedFrom(supabase)
      .select("data,version")
      .eq("vertical", vertical)
      .eq("region", "national")
      .eq("is_active", true)
      .maybeSingle();

    if (national.error) {
      throw new Error(`benchmark fallback read failed: ${national.error.message}`);
    }
    if (national.data) {
      return VerticalBenchmarksSchema.parse(national.data.data);
    }
  }

  throw new BenchmarkNotFoundError(vertical, region);
}

export async function seedBenchmarks(
  benchmarks: VerticalBenchmarks[],
): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (col: string, val: boolean) => Promise<{ error: { message: string } | null }> };
      insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: deleteError } = await supabaseAny
    .from(TABLE)
    .delete()
    .eq("is_active", true);
  if (deleteError) {
    throw new Error(`benchmark seed (delete active) failed: ${deleteError.message}`);
  }

  const rows = benchmarks.map((b) => ({
    vertical: b.vertical,
    region: b.region,
    version: b.version,
    source: b.source,
    effective_from: b.effective_from,
    is_active: true,
    data: b,
  }));

  const { error } = await supabaseAny.from(TABLE).insert(rows);
  if (error) throw new Error(`benchmark seed (insert) failed: ${error.message}`);
}
