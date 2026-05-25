"use client";

import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Client-side password update. Uses the active session (no current
 * password required — Supabase doesn't expose verifyPassword on the
 * client SDK). For sensitive flows we could enforce reauth here, but
 * the existing /reset-password flow already trusts the session, so we
 * stay consistent.
 */
export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) {
      setMsg({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setMsg({ tone: "err", text: "Passwords don't match." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg({ tone: "err", text: error.message });
      return;
    }
    setPassword("");
    setConfirm("");
    setMsg({ tone: "ok", text: "Password updated." });
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md">
      <div className="space-y-1.5">
        <label
          htmlFor="new-password"
          className="block text-[13px] font-medium text-ink"
        >
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={busy}
            className="w-full rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 pr-10 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-ink"
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-[11.5px] text-text-muted">At least 8 characters.</p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirm-password"
          className="block text-[13px] font-medium text-ink"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={busy}
          className="w-full rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
        />
      </div>

      {msg && (
        <div
          role={msg.tone === "err" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-[13px] ${
            msg.tone === "ok"
              ? "bg-success/10 text-success"
              : "bg-alert/10 text-alert"
          }`}
        >
          {msg.tone === "ok" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
