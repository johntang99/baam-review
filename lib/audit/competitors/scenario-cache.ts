import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AuditCompetitorsDataSchema,
  type AuditCompetitorsData,
} from "./types";

const TABLE = "audit_competitor_scenarios";
const SCENARIO_TTL_MS = 6 * 60 * 60 * 1000;
export type CompetitorScenarioStatus = "ready" | "hydrating" | "failed";
const memoryFallback = new Map<
  string,
  {
    id: string;
    user_id: string;
    primary_place_id: string;
    service_override: string;
    service_override_canonical: string | null;
    selected_place_ids: string[];
    competitors_data: AuditCompetitorsData;
    status: CompetitorScenarioStatus;
    total_competitors: number;
    hydrated_competitors: number;
    failed_competitors: number;
    hydrated_place_ids: string[];
    created_at: string;
    updated_at: string;
    expires_at: string;
  }
>();

interface ScenarioRow {
  id: string;
  user_id: string;
  primary_place_id: string;
  service_override: string;
  service_override_canonical: string | null;
  selected_place_ids: string[] | null;
  competitors_data: unknown;
  status?: CompetitorScenarioStatus | null;
  total_competitors?: number | null;
  hydrated_competitors?: number | null;
  failed_competitors?: number | null;
  hydrated_place_ids?: string[] | null;
  created_at: string;
  updated_at?: string;
  expires_at: string;
}

function untypedFrom(supabase: ReturnType<typeof createServiceClient>) {
  return (supabase as unknown as {
    from: (table: string) => {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
      update: (row: unknown) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            gt: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: ScenarioRow | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
  }).from(TABLE);
}

export async function createCompetitorScenario(input: {
  user_id: string;
  primary_place_id: string;
  service_override: string;
  service_override_canonical?: string | null;
  competitors_data: AuditCompetitorsData;
  status?: CompetitorScenarioStatus;
  total_competitors?: number;
  hydrated_competitors?: number;
  failed_competitors?: number;
  hydrated_place_ids?: string[];
}): Promise<{ scenario_id: string; expires_at: string }> {
  const supabase = createServiceClient();
  const scenario_id = randomUUID();
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + SCENARIO_TTL_MS).toISOString();
  const selected_place_ids = input.competitors_data.competitors
    .map((item) => item.google.business.place_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const inferredHydratedPlaceIds = deriveHydratedPlaceIds(input.competitors_data);
  const total_competitors =
    input.total_competitors ?? input.competitors_data.competitors.length;
  const hydrated_competitors =
    input.hydrated_competitors ?? inferredHydratedPlaceIds.length;
  const failed_competitors = input.failed_competitors ?? 0;
  const status =
    input.status ?? (hydrated_competitors >= total_competitors ? "ready" : "hydrating");
  const hydrated_place_ids = unique(
    (input.hydrated_place_ids ?? inferredHydratedPlaceIds).filter(Boolean),
  );

  const row = {
    id: scenario_id,
    user_id: input.user_id,
    primary_place_id: input.primary_place_id,
    service_override: input.service_override,
    service_override_canonical: input.service_override_canonical ?? null,
    selected_place_ids,
    competitors_data: input.competitors_data,
    status,
    total_competitors,
    hydrated_competitors,
    failed_competitors,
    hydrated_place_ids,
    created_at,
    updated_at: created_at,
    expires_at,
  };

  const { error } = await untypedFrom(supabase).insert(row);
  if (error) {
    const legacyRow = {
      id: scenario_id,
      user_id: input.user_id,
      primary_place_id: input.primary_place_id,
      service_override: input.service_override,
      service_override_canonical: input.service_override_canonical ?? null,
      selected_place_ids,
      competitors_data: input.competitors_data,
      expires_at,
    };
    const legacy = await untypedFrom(supabase).insert(legacyRow);
    if (!legacy.error) {
      return { scenario_id, expires_at };
    }
    memoryFallback.set(scenario_id, {
      ...row,
      selected_place_ids,
      competitors_data: input.competitors_data,
      status,
      total_competitors,
      hydrated_competitors,
      failed_competitors,
      hydrated_place_ids,
      created_at,
      updated_at: created_at,
      expires_at,
    });
  }

  return { scenario_id, expires_at };
}

export async function readCompetitorScenario(input: {
  scenario_id: string;
  user_id: string;
}): Promise<{
  scenario_id: string;
  primary_place_id: string;
  service_override: string;
  service_override_canonical: string | null;
  selected_place_ids: string[];
  competitors_data: AuditCompetitorsData;
  status: CompetitorScenarioStatus;
  total_competitors: number;
  hydrated_competitors: number;
  failed_competitors: number;
  hydrated_place_ids: string[];
  created_at: string;
  updated_at: string;
  expires_at: string;
} | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const inMemory = memoryFallback.get(input.scenario_id);
  if (inMemory) {
    if (inMemory.user_id !== input.user_id) return null;
    if (inMemory.expires_at <= nowIso) {
      memoryFallback.delete(input.scenario_id);
      return null;
    }
    return {
      scenario_id: inMemory.id,
      primary_place_id: inMemory.primary_place_id,
      service_override: inMemory.service_override,
      service_override_canonical: inMemory.service_override_canonical,
      selected_place_ids: inMemory.selected_place_ids,
      competitors_data: inMemory.competitors_data,
      created_at: inMemory.created_at,
      status: inMemory.status,
      total_competitors: inMemory.total_competitors,
      hydrated_competitors: inMemory.hydrated_competitors,
      failed_competitors: inMemory.failed_competitors,
      hydrated_place_ids: inMemory.hydrated_place_ids,
      updated_at: inMemory.updated_at,
      expires_at: inMemory.expires_at,
    };
  }

  const { data, error } = await untypedFrom(supabase)
    .select(
      "id,user_id,primary_place_id,service_override,service_override_canonical,selected_place_ids,competitors_data,status,total_competitors,hydrated_competitors,failed_competitors,hydrated_place_ids,created_at,updated_at,expires_at",
    )
    .eq("id", input.scenario_id)
    .eq("user_id", input.user_id)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error || !data) {
    const legacyRead = await untypedFrom(supabase)
      .select(
        "id,user_id,primary_place_id,service_override,service_override_canonical,selected_place_ids,competitors_data,created_at,expires_at",
      )
      .eq("id", input.scenario_id)
      .eq("user_id", input.user_id)
      .gt("expires_at", nowIso)
      .maybeSingle();
    if (legacyRead.error || !legacyRead.data) return null;
    return normalizeScenarioRow(legacyRead.data);
  }

  return normalizeScenarioRow(data);
}

function normalizeScenarioRow(data: ScenarioRow): {
  scenario_id: string;
  primary_place_id: string;
  service_override: string;
  service_override_canonical: string | null;
  selected_place_ids: string[];
  competitors_data: AuditCompetitorsData;
  status: CompetitorScenarioStatus;
  total_competitors: number;
  hydrated_competitors: number;
  failed_competitors: number;
  hydrated_place_ids: string[];
  created_at: string;
  updated_at: string;
  expires_at: string;
} | null {

  const parsed = AuditCompetitorsDataSchema.safeParse(data.competitors_data);
  if (!parsed.success) return null;
  const hydrated_place_ids = Array.isArray(data.hydrated_place_ids)
    ? unique(
        data.hydrated_place_ids
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0),
      )
    : deriveHydratedPlaceIds(parsed.data);
  const total_competitors =
    typeof data.total_competitors === "number" && data.total_competitors >= 0
      ? data.total_competitors
      : parsed.data.competitors.length;
  const hydrated_competitors =
    typeof data.hydrated_competitors === "number" && data.hydrated_competitors >= 0
      ? data.hydrated_competitors
      : hydrated_place_ids.length;
  const failed_competitors =
    typeof data.failed_competitors === "number" && data.failed_competitors >= 0
      ? data.failed_competitors
      : 0;
  const statusRaw = String(data.status ?? "").toLowerCase();
  const status: CompetitorScenarioStatus =
    statusRaw === "ready" || statusRaw === "hydrating" || statusRaw === "failed"
      ? (statusRaw as CompetitorScenarioStatus)
      : hydrated_competitors >= total_competitors
        ? "ready"
        : "hydrating";

  return {
    scenario_id: data.id,
    primary_place_id: data.primary_place_id,
    service_override: data.service_override,
    service_override_canonical: data.service_override_canonical,
    selected_place_ids: Array.isArray(data.selected_place_ids)
      ? data.selected_place_ids
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0)
      : [],
    competitors_data: parsed.data,
    status,
    total_competitors,
    hydrated_competitors,
    failed_competitors,
    hydrated_place_ids,
    created_at: data.created_at,
    updated_at: data.updated_at ?? data.created_at,
    expires_at: data.expires_at,
  };
}

export async function updateCompetitorScenario(input: {
  scenario_id: string;
  user_id: string;
  competitors_data?: AuditCompetitorsData;
  status?: CompetitorScenarioStatus;
  total_competitors?: number;
  hydrated_competitors?: number;
  failed_competitors?: number;
  hydrated_place_ids?: string[];
}) {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.competitors_data) patch.competitors_data = input.competitors_data;
  if (input.status) patch.status = input.status;
  if (typeof input.total_competitors === "number") {
    patch.total_competitors = input.total_competitors;
  }
  if (typeof input.hydrated_competitors === "number") {
    patch.hydrated_competitors = input.hydrated_competitors;
  }
  if (typeof input.failed_competitors === "number") {
    patch.failed_competitors = input.failed_competitors;
  }
  if (input.hydrated_place_ids) {
    patch.hydrated_place_ids = unique(input.hydrated_place_ids.filter(Boolean));
  }

  const { error } = await untypedFrom(supabase)
    .update(patch)
    .eq("id", input.scenario_id)
    .eq("user_id", input.user_id);

  if (error) {
    const legacyPatch: Record<string, unknown> = {};
    if (input.competitors_data) legacyPatch.competitors_data = input.competitors_data;
    if (input.hydrated_place_ids) {
      legacyPatch.selected_place_ids = unique(input.hydrated_place_ids.filter(Boolean));
    }
    if (Object.keys(legacyPatch).length > 0) {
      const legacy = await untypedFrom(supabase)
        .update(legacyPatch)
        .eq("id", input.scenario_id)
        .eq("user_id", input.user_id);
      if (!legacy.error) return;
    }
    const current = memoryFallback.get(input.scenario_id);
    if (current && current.user_id === input.user_id) {
      memoryFallback.set(input.scenario_id, {
        ...current,
        competitors_data: input.competitors_data ?? current.competitors_data,
        status: input.status ?? current.status,
        total_competitors: input.total_competitors ?? current.total_competitors,
        hydrated_competitors:
          input.hydrated_competitors ?? current.hydrated_competitors,
        failed_competitors: input.failed_competitors ?? current.failed_competitors,
        hydrated_place_ids: input.hydrated_place_ids
          ? unique(input.hydrated_place_ids.filter(Boolean))
          : current.hydrated_place_ids,
        updated_at: String(patch.updated_at),
      });
      return;
    }
    // Legacy table shape (without progress columns) can't persist status-only
    // patches; tolerate this so preview remains functional until migration runs.
    if (Object.keys(legacyPatch).length === 0) return;
    throw new Error(`update competitor scenario failed: ${error.message}`);
  }
}

function deriveHydratedPlaceIds(data: AuditCompetitorsData) {
  return unique(
    data.competitors
      .filter(
        (item) => item.google.meta.data_source === "place_details_plus_outscraper",
      )
      .map((item) => item.google.business.place_id)
      .filter((value): value is string => Boolean(value)),
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
