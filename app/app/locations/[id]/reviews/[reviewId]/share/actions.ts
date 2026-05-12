"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Action = Database["public"]["Tables"]["social_graphics"]["Insert"]["action"];
type Size = Database["public"]["Tables"]["social_graphics"]["Insert"]["size"];

const VALID_ACTIONS: Action[] = ["view", "copy_url", "download", "open"];
const VALID_SIZES: Size[] = ["og", "square", "story"];

export async function logShareEvent(input: {
  locationId: string;
  googleReviewId: string | null;
  size: string;
  theme: string;
  action: string;
}): Promise<void> {
  // Auth check — only owners trigger this from admin. The service client
  // does the actual write so we don't need a separate RLS policy for insert.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!VALID_ACTIONS.includes(input.action as Action)) return;
  if (!VALID_SIZES.includes(input.size as Size)) return;

  const service = createServiceClient();
  await service.from("social_graphics").insert({
    location_id: input.locationId,
    google_review_id: input.googleReviewId,
    size: input.size as Size,
    theme: input.theme,
    action: input.action as Action,
  });
}
