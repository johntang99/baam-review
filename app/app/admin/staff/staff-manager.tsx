"use client";

import { useState, useTransition } from "react";
import {
  UserPlus,
  Mail,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { inviteStaff, promoteByEmail, demoteStaffUser, setOpsRole } from "./actions";
import type { OpsRole } from "@/lib/database.types";

interface StaffRow {
  user_id: string;
  full_name: string | null;
  email: string;
  ops_role: OpsRole | null;
  created_at: string;
}

interface StaffManagerProps {
  currentUserId: string;
  staff: StaffRow[];
}

const ROLE_OPTIONS: { value: OpsRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "account_manager", label: "Account manager" },
];

export function StaffManager({ currentUserId, staff }: StaffManagerProps) {
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("account_manager");
  const [promoteEmail, setPromoteEmail] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const onInvite = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const result = await inviteStaff(formData);
      if (result.ok) {
        setInviteEmail("");
        setInviteName("");
        setInviteRole("account_manager");
        setMsg({
          tone: "ok",
          text: "Invite sent. They'll set their password via the magic-link email.",
        });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Could not send invite" });
      }
    });
  };

  const onPromote = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const result = await promoteByEmail(formData);
      if (result.ok) {
        setPromoteEmail("");
        setMsg({
          tone: "ok",
          text: "Promoted — they can now see ops tools.",
        });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Something went wrong" });
      }
    });
  };

  const onDemote = (userId: string, email: string) => {
    if (!confirm(`Remove internal access for ${email}?`)) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const result = await demoteStaffUser(fd);
      if (result.ok) {
        setMsg({ tone: "ok", text: `Removed access for ${email}.` });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Something went wrong" });
      }
    });
  };

  const onRoleChange = (userId: string, role: string, label: string) => {
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("ops_role", role);
    startTransition(async () => {
      const result = await setOpsRole(fd);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text: role
            ? `Role updated for ${label}.`
            : `Cleared role for ${label}.`,
        });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Could not update role" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Invite new staff */}
      <section className="rounded-2xl border border-border-base bg-paper p-6">
        <h2 className="font-display text-[18px] text-ink flex items-center gap-2">
          <Mail className="h-4 w-4 text-forest" />
          Invite a new staff member
        </h2>
        <p className="text-[13px] text-text-soft mt-1">
          They&apos;ll get a magic-link email to set their password. On first
          login they&apos;ll land directly inside the BAAM Operations tenant.
        </p>
        <form action={onInvite} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="newstaff@baamplatform.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
          />
          <input
            type="text"
            name="full_name"
            placeholder="Full name (optional)"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
          />
          <select
            name="ops_role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
          >
            <option value="">No role</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending || !inviteEmail.trim()}>
            {pending ? "Sending…" : "Invite"}
          </Button>
        </form>
      </section>

      {/* Promote existing customer account */}
      <section className="rounded-2xl border border-border-base bg-paper p-6">
        <h2 className="font-display text-[18px] text-ink flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-forest" />
          Promote an existing account
        </h2>
        <p className="text-[13px] text-text-soft mt-1">
          For someone who already signed up at <code>/signup</code> but isn&apos;t
          yet inside BAAM Operations. They&apos;ll be moved in, their personal
          account cleaned up, and the magic-link skipped.
        </p>
        <form action={onPromote} className="mt-4 flex gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="existing@baamplatform.com"
            value={promoteEmail}
            onChange={(e) => setPromoteEmail(e.target.value)}
            disabled={pending}
            className="flex-1 rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
          />
          <Button type="submit" disabled={pending || !promoteEmail.trim()}>
            {pending ? "Promoting…" : "Promote"}
          </Button>
        </form>
      </section>

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

      {/* Current staff */}
      <section className="rounded-2xl border border-border-base bg-paper overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
          <h2 className="font-display text-[18px] text-ink">
            Current internal users
          </h2>
          <span className="text-[12px] uppercase tracking-[0.12em] text-text-muted">
            {staff.length} {staff.length === 1 ? "user" : "users"}
          </span>
        </div>
        {staff.length === 0 ? (
          <p className="px-6 py-8 text-[14px] text-text-muted text-center">
            No internal users yet. Invite one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-border-base">
            {staff.map((s) => {
              const isMe = s.user_id === currentUserId;
              const label = s.email;
              return (
                <li
                  key={s.user_id}
                  className="flex items-center gap-4 px-6 py-3.5 text-[13.5px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">
                      {s.full_name || s.email}
                      {isMe && (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.1em] text-forest">
                          you
                        </span>
                      )}
                    </p>
                    {s.full_name && (
                      <p className="text-[12.5px] text-text-soft truncate">
                        {s.email}
                      </p>
                    )}
                  </div>
                  <select
                    value={s.ops_role ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      onRoleChange(s.user_id, e.target.value, label)
                    }
                    className="rounded-md border border-border-base bg-cream-deep/30 px-2 py-1 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-forest/40 disabled:opacity-40"
                  >
                    <option value="">No role</option>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[12px] text-text-muted hidden md:block">
                    since {formatDate(s.created_at)}
                  </p>
                  <button
                    type="button"
                    disabled={isMe || pending}
                    onClick={() => onDemote(s.user_id, s.email)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-base px-2.5 py-1 text-[12px] text-text-soft hover:bg-alert/[0.05] hover:text-alert hover:border-alert/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      isMe
                        ? "Ask another internal user to demote you"
                        : "Remove from BAAM Operations"
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
