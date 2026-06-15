"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Webhook,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiKeyRow } from "@/lib/integrations/api-keys";
import {
  createKeyAction,
  revealKeyAction,
  revokeKeyAction,
  updateKeyLimitAction,
} from "./api-keys-actions";

interface Props {
  locationId: string;
  appUrl: string;
  initialKeys: ApiKeyRow[];
}

/**
 * Location Setup → Integrations. Generate / reveal-once / revoke per-location
 * API keys for the universal intake endpoint, plus a copy-paste usage snippet.
 * The plaintext key is shown exactly once, right after creation.
 */
export function ApiKeysManager({ locationId, appUrl, initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);
  // Per-row reveal: keyId → decrypted plaintext (fetched on demand).
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedRow, setCopiedRow] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const endpoint = `${appUrl.replace(/\/$/, "")}/api/integrations/review-request`;
  const activeCount = keys.filter((k) => !k.revoked_at).length;

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await createKeyAction(locationId, name.trim() || "Integration key");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setJustCreated(res.created.key);
      setName("");
      setKeys((prev) => [
        {
          id: res.created.id,
          name: name.trim() || "Integration key",
          key_prefix: res.created.prefix,
          last_used_at: null,
          created_at: new Date().toISOString(),
          revoked_at: null,
          daily_limit: 5000,
          revealable: true,
        },
        ...prev,
      ]);
    });
  }

  function onRevoke(keyId: string) {
    if (!confirm("Revoke this key? Any integration using it stops working immediately.")) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeKeyAction(locationId, keyId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k,
        ),
      );
    });
  }

  function onLimitChange(keyId: string, value: number) {
    setKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, daily_limit: value } : k)),
    );
  }

  function onLimitSave(keyId: string) {
    const k = keys.find((x) => x.id === keyId);
    if (!k) return;
    setError(null);
    startTransition(async () => {
      const res = await updateKeyLimitAction(locationId, keyId, k.daily_limit || 1);
      if (res.ok) {
        setKeys((prev) =>
          prev.map((x) => (x.id === keyId ? { ...x, daily_limit: res.dailyLimit } : x)),
        );
      } else {
        setError(res.error);
      }
    });
  }

  async function copy(text: string, which: "key" | "curl") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  // Fetch (decrypt) a key on demand, return its plaintext, and cache it.
  async function ensureRevealed(keyId: string): Promise<string | null> {
    if (revealed[keyId]) return revealed[keyId];
    const res = await revealKeyAction(locationId, keyId);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setRevealed((prev) => ({ ...prev, [keyId]: res.key }));
    return res.key;
  }

  function onToggleReveal(keyId: string) {
    setError(null);
    if (revealed[keyId]) {
      // Hide it again.
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[keyId];
        return next;
      });
      return;
    }
    startTransition(async () => {
      await ensureRevealed(keyId);
    });
  }

  function onCopyRow(keyId: string) {
    setError(null);
    startTransition(async () => {
      const key = await ensureRevealed(keyId);
      if (!key) return;
      try {
        await navigator.clipboard.writeText(key);
        setCopiedRow(keyId);
        setTimeout(() => setCopiedRow(null), 1600);
      } catch {
        /* ignore */
      }
    });
  }

  const curlSnippet = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${justCreated ?? "<YOUR_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jane Doe","email":"jane@example.com","phone":"+15551234567","service":"Haircut","external_id":"txn-123"}'`;

  return (
    <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
          <Webhook className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[18px] text-ink leading-tight">
            Integrations · API keys
          </h2>
          <p className="text-[13px] text-text-soft mt-0.5 leading-relaxed">
            Let this location&apos;s POS / CRM / checkout push customer contacts
            into the review queue. Each contact is added to the
            &ldquo;Incoming — from integrations&rdquo; list for review and
            sending — nothing is sent automatically by email.
          </p>
        </div>
      </div>

      {/* Endpoint */}
      <div className="rounded-lg border border-border-soft bg-cream-deep/30 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-[0.1em] text-text-muted mb-1">
          Endpoint
        </div>
        <code className="text-[12.5px] text-ink break-all">POST {endpoint}</code>
      </div>

      {/* Reveal-once banner */}
      {justCreated && (
        <div className="rounded-lg border border-forest/30 bg-forest/[0.05] p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-medium text-forest">
            <Check className="h-4 w-4" /> New key created
          </div>
          <p className="text-[12px] text-text-soft">
            Copy it into your integration. You can also reveal and copy it again
            anytime from the list below.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border-base bg-paper px-2.5 py-1.5 text-[12.5px] text-ink break-all">
              {justCreated}
            </code>
            <button
              type="button"
              onClick={() => copy(justCreated, "key")}
              className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-2.5 py-1.5 text-[12px] text-text-soft hover:text-ink hover:border-ink"
            >
              {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "key" ? "Copied" : "Copy"}
            </button>
          </div>
          <details className="text-[12px] text-text-soft">
            <summary className="cursor-pointer hover:text-ink">Show example request</summary>
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md border border-border-base bg-paper p-2.5 text-[11.5px] text-ink whitespace-pre">{curlSnippet}</pre>
              <button
                type="button"
                onClick={() => copy(curlSnippet, "curl")}
                className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-2 py-1.5 text-[12px] text-text-soft hover:text-ink hover:border-ink"
              >
                {copied === "curl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </details>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-alert/10 px-3 py-2 text-[13px] text-alert" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generate */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[12px] font-medium text-ink mb-1">
            New key label (optional)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Square POS"
            className="w-full rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>
        <Button onClick={onGenerate} disabled={pending}>
          <Plus className="h-4 w-4" />
          Generate key
        </Button>
      </div>

      {/* Existing keys */}
      <div>
        <div className="text-[12px] font-medium text-ink mb-2">
          Keys{" "}
          <span className="text-text-muted font-normal">
            ({activeCount} active)
          </span>
        </div>
        {keys.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-base px-3 py-3 text-[13px] text-text-muted text-center">
            No keys yet — generate one to connect a system.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {keys.map((k) => (
              <li
                key={k.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-[13px] ${
                  k.revoked_at
                    ? "border-border-soft bg-cream-deep/20 opacity-60"
                    : "border-border-base bg-cream-deep/20"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink truncate">{k.name}</span>
                    <code className="text-[11.5px] text-text-muted">{k.key_prefix}…</code>
                    {k.revoked_at && (
                      <span className="text-[10.5px] uppercase tracking-wide text-alert">Revoked</span>
                    )}
                  </div>
                  {revealed[k.id] && (
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded border border-border-base bg-paper px-2 py-1 text-[11.5px] text-ink break-all">
                        {revealed[k.id]}
                      </code>
                    </div>
                  )}
                  <div className="text-[11.5px] text-text-muted">
                    {k.last_used_at
                      ? `Last used ${new Date(k.last_used_at).toLocaleString()}`
                      : "Never used"}
                  </div>
                  {!k.revoked_at && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-text-muted">
                      <span>Daily cap</span>
                      <input
                        type="number"
                        min={1}
                        value={k.daily_limit}
                        disabled={pending}
                        onChange={(e) => onLimitChange(k.id, Number(e.target.value))}
                        onBlur={() => onLimitSave(k.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-20 rounded border border-border-base bg-paper px-1.5 py-0.5 text-[11.5px] text-ink focus:border-forest focus:outline-none disabled:opacity-50"
                      />
                      <span>requests/day</span>
                    </div>
                  )}
                </div>
                {!k.revoked_at && k.revealable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggleReveal(k.id)}
                      disabled={pending}
                      className="text-text-muted hover:text-ink disabled:opacity-40"
                      title={revealed[k.id] ? "Hide key" : "Reveal key"}
                      aria-label={revealed[k.id] ? `Hide ${k.name}` : `Reveal ${k.name}`}
                    >
                      {revealed[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyRow(k.id)}
                      disabled={pending}
                      className="text-text-muted hover:text-ink disabled:opacity-40"
                      title="Copy key"
                      aria-label={`Copy ${k.name}`}
                    >
                      {copiedRow === k.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
                {!k.revoked_at && (
                  <button
                    type="button"
                    onClick={() => onRevoke(k.id)}
                    disabled={pending}
                    className="text-text-muted hover:text-alert disabled:opacity-40"
                    title="Revoke"
                    aria-label={`Revoke ${k.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
