"use client";

import { useEffect, useState, useTransition } from "react";
import { X, UserPlus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assignManager, unassignManager } from "./actions";

export interface AccountManagerOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

export interface AssignedManager {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface AssignManagerModalProps {
  locationId: string;
  locationName: string;
  /** Account managers available to add (already filtered to ops_role='account_manager'). */
  managers: AccountManagerOption[];
  /** Currently assigned managers for this location. */
  currentAssignments: AssignedManager[];
  /** Trigger button label override; defaults to "Assign Manager". */
  triggerLabel?: string;
}

/**
 * Click-to-open modal that lists the currently-assigned account managers
 * for a location and lets the user add/remove them. Modeled on the
 * baam-platform Assign User dialog.
 */
export function AssignManagerModal({
  locationId,
  locationName,
  managers,
  currentAssignments,
  triggerLabel = "Assign",
}: AssignManagerModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );
  // Mirror server state in local state for optimistic updates — the server
  // action revalidates the path so a refresh would re-sync, but we want
  // the modal to feel instant.
  const [assigned, setAssigned] = useState<AssignedManager[]>(
    currentAssignments,
  );

  useEffect(() => {
    setAssigned(currentAssignments);
  }, [currentAssignments]);

  // Filter out managers already assigned so the dropdown only shows new ones.
  const assignedIds = new Set(assigned.map((a) => a.user_id));
  const available = managers.filter((m) => !assignedIds.has(m.user_id));

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId) return;
    const target = managers.find((m) => m.user_id === selectedManagerId);
    setMsg(null);
    const fd = new FormData();
    fd.set("location_id", locationId);
    fd.set("manager_user_id", selectedManagerId);
    startTransition(async () => {
      const result = await assignManager(fd);
      if (result.ok) {
        if (target) {
          setAssigned((prev) => [...prev, target]);
        }
        setSelectedManagerId("");
        setMsg({
          tone: "ok",
          text: `${target?.full_name ?? target?.email ?? "Manager"} added.`,
        });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Could not add manager" });
      }
    });
  };

  const onRemove = (managerId: string, label: string) => {
    if (!confirm(`Remove ${label} from this client?`)) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("location_id", locationId);
    fd.set("manager_user_id", managerId);
    startTransition(async () => {
      const result = await unassignManager(fd);
      if (result.ok) {
        setAssigned((prev) => prev.filter((a) => a.user_id !== managerId));
        setMsg({ tone: "ok", text: `Removed ${label}.` });
      } else {
        setMsg({ tone: "err", text: result.error ?? "Could not remove" });
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-text-soft hover:bg-hover hover:text-ink transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5" />
        {triggerLabel}
        {assigned.length > 0 && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-forest/10 text-forest px-1.5 text-[10px] font-semibold leading-[1.4]">
            {assigned.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Assign manager to ${locationName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-paper shadow-2xl">
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border-base">
              <div>
                <h2 className="font-display text-[19px] text-ink leading-tight">
                  Assign manager
                </h2>
                <p className="text-[12.5px] text-text-soft mt-0.5 truncate max-w-[280px]">
                  {locationName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-ink p-1 -m-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Add form */}
              <form onSubmit={onAdd} className="space-y-2">
                <label className="block text-[12.5px] font-medium text-ink">
                  Add an account manager
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    disabled={pending || available.length === 0}
                    className="flex-1 rounded-md border border-border-base bg-cream-deep/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-forest/40"
                  >
                    <option value="">
                      {available.length === 0
                        ? "All account managers assigned"
                        : "Choose a manager…"}
                    </option>
                    {available.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name ? `${m.full_name} (${m.email})` : m.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pending || !selectedManagerId}
                  >
                    Add
                  </Button>
                </div>
              </form>

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

              {/* Current assignments */}
              <div>
                <p className="text-[12.5px] font-medium text-ink mb-2">
                  Currently assigned
                </p>
                {assigned.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border-base px-3 py-3 text-[13px] text-text-muted text-center">
                    No managers yet — pick one above.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {assigned.map((a) => {
                      const label = a.full_name
                        ? `${a.full_name} (${a.email})`
                        : a.email;
                      return (
                        <li
                          key={a.user_id}
                          className="flex items-center gap-2 rounded-md border border-border-base bg-cream-deep/20 px-3 py-2 text-[13px]"
                        >
                          <span className="flex-1 truncate">{label}</span>
                          <button
                            type="button"
                            onClick={() => onRemove(a.user_id, label)}
                            disabled={pending}
                            className="text-text-muted hover:text-alert disabled:opacity-40"
                            title="Remove"
                            aria-label={`Remove ${label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="px-6 pb-5 pt-1 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
