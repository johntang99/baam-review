"use server";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Language } from "@/lib/database.types";
import {
  isLanguage,
} from "@/lib/i18n/review";

type ActionType =
  Database["public"]["Tables"]["post_review_actions"]["Insert"]["action_type"];

type ShareDest =
  | "wechat"
  | "sms"
  | "copy"
  | "more"
  | "whatsapp"
  | "email";

const VALID_ACTIONS: readonly ActionType[] = [
  "view",
  "book_click",
  "refer_click",
  "share_click",
  "follow_click",
  "done_click",
] as const;

const VALID_DESTS: readonly ShareDest[] = [
  "wechat",
  "sms",
  "copy",
  "more",
  "whatsapp",
  "email",
] as const;

interface LogPostReviewActionInput {
  locationId: string;
  requestId: string | null;
  actionType: string;
  shareDestination?: string | null;
  shareToken?: string | null;
  language?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a single interaction from the post-review thank-you surface
 * (Convert + Refer stages of the 7-step Review-to-Revenue loop).
 *
 * Anonymous insert via service-role client. RLS still gates SELECT to the
 * account that owns the location.
 */
export async function logPostReviewAction(
  input: LogPostReviewActionInput,
): Promise<{ ok: boolean }> {
  if (!input.locationId) return { ok: false };

  const action = input.actionType as ActionType;
  if (!VALID_ACTIONS.includes(action)) return { ok: false };

  const destination =
    input.shareDestination && VALID_DESTS.includes(input.shareDestination as ShareDest)
      ? (input.shareDestination as ShareDest)
      : null;

  const language: Language | null =
    isLanguage(input.language) ? (input.language as Language) : null;

  const supabase = createServiceClient();
  const { error } = await supabase.from("post_review_actions").insert({
    location_id: input.locationId,
    request_id: input.requestId ?? null,
    action_type: action,
    share_destination: destination,
    share_token: input.shareToken ?? null,
    language,
    metadata: (input.metadata ?? {}) as Database["public"]["Tables"]["post_review_actions"]["Insert"]["metadata"],
  });

  if (error) {
    console.error("post_review_actions insert failed", error);
    return { ok: false };
  }

  return { ok: true };
}
