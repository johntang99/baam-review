"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, Copy, AlertCircle, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  connectAcuityAction,
  disconnectProviderAction,
} from "./connections-actions";

interface Props {
  locationId: string;
  appUrl: string;
  acuityConnected: boolean;
}

/**
 * Location Setup → native connectors that need stored credentials + an API
 * fetch (currently Acuity). The client pastes their Acuity User ID + API Key;
 * we then resolve appointment contacts from Acuity's webhook.
 */
export function ConnectionsManager({ locationId, appUrl, acuityConnected }: Props) {
  const [connected, setConnected] = useState(acuityConnected);
  const [userId, setUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/integrations/acuity?key=<YOUR_API_KEY>`;

  function onConnect() {
    setError(null);
    startTransition(async () => {
      const res = await connectAcuityAction(locationId, userId, apiKey);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConnected(true);
      setUserId("");
      setApiKey("");
    });
  }

  function onDisconnect() {
    if (!confirm("Disconnect Acuity? New appointments will stop flowing in.")) return;
    setError(null);
    startTransition(async () => {
      const res = await disconnectProviderAction(locationId, "acuity");
      if (res.ok) setConnected(false);
      else setError(res.error);
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
          <Plug className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[18px] text-ink leading-tight">
            Native connectors
          </h2>
          <p className="text-[13px] text-text-soft mt-0.5 leading-relaxed">
            Connect a booking/POS system that needs its own credentials. (Tools
            like Shopify or Calendly don&apos;t need this — point their webhook
            straight at the API key endpoint above.)
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-alert/10 px-3 py-2 text-[13px] text-alert" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Acuity */}
      <div className="rounded-lg border border-border-base p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-forest" />
          <span className="font-medium text-ink text-[14px]">Acuity Scheduling</span>
          {connected && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-forest/10 text-forest px-2 py-0.5 text-[11px] font-medium">
              <Check className="h-3 w-3" /> Connected
            </span>
          )}
        </div>

        {!connected ? (
          <>
            <p className="text-[12.5px] text-text-soft">
              In Acuity → <strong>Account → Integrations → API</strong>, copy the
              User ID and API Key, then paste them here.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Acuity User ID"
                className="flex-1 min-w-[140px] rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Acuity API Key"
                type="password"
                className="flex-1 min-w-[140px] rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <Button onClick={onConnect} disabled={pending || !userId.trim() || !apiKey.trim()}>
                Connect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-text-soft">
              Last step — in Acuity → <strong>Integrations → Webhooks</strong>,
              add this URL for the <em>Appointment Scheduled</em> event (replace
              the placeholder with an API key from the section above):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border-base bg-cream-deep/20 px-2.5 py-1.5 text-[12px] text-ink break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-2.5 py-1.5 text-[12px] text-text-soft hover:text-ink hover:border-ink"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending}
              className="text-[12.5px] text-text-muted hover:text-alert disabled:opacity-40"
            >
              Disconnect Acuity
            </button>
          </>
        )}
      </div>
    </section>
  );
}
