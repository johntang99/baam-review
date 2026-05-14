"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAllReviews, type SyncAllResult } from "./actions";

export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncAllResult | null>(null);

  function onSync() {
    setResult(null);
    startTransition(async () => {
      const r = await syncAllReviews();
      setResult(r);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={onSync} disabled={pending}>
        <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {pending ? "Syncing…" : "Sync now"}
      </Button>

      {result && !result.ok && result.error && (
        <div
          role="alert"
          className="flex gap-2.5 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[13px] text-alert max-w-md"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{result.error}</p>
        </div>
      )}

      {result?.ok && (
        <div className="flex gap-2.5 rounded-xl border border-success/30 bg-success/5 p-3 text-[13px] text-text max-w-md">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
          <div className="space-y-1">
            <p>
              Synced {result.locations ?? 0} location
              {result.locations === 1 ? "" : "s"}. {result.inserted ?? 0} new ·{" "}
              {result.updated ?? 0} updated
              {result.alerts
                ? ` · ${result.alerts} alert${result.alerts === 1 ? "" : "s"} sent`
                : ""}
              .
            </p>
            {result.errors && result.errors.length > 0 && (
              <ul className="text-[12px] text-text-soft list-disc pl-4">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
