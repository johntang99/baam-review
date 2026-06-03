"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Submit button for the picker's "Use this location" form. Shows a
 * spinner + "Adding…" while the server action runs so the user knows
 * the click was received — without this the button sits idle for the
 * 1–3 seconds it takes to insert the location row and finalize Stripe
 * wiring on Start-Now customer paths.
 */
export function UseLocationButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
