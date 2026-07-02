"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface PendingAction {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => Promise<unknown>;
}

/**
 * Shared CRUD interactions for list pages: confirmed deletes and direct status
 * mutations, both refreshing the list afterward. Render `dialog` once per page.
 */
export function useRowActions(resource: string, onChange: () => void) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const { run, loading } = useMutation();

  async function confirm() {
    if (!pending) return;
    try {
      await run(pending.action);
      setPending(null);
      onChange();
    } catch {
      setPending(null);
    }
  }

  /** Ask to delete a record, with confirmation. */
  function remove(id: number | string, name: string) {
    setPending({
      title: "Delete record",
      message: `Delete ${name}? This action cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      action: () => api.del(`/${resource}/${id}`),
    });
  }

  /** Generic confirmed action (e.g. discharge, cancel). */
  function ask(cfg: {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    action: () => Promise<unknown>;
  }) {
    setPending({
      title: cfg.title ?? "Are you sure?",
      message: cfg.message,
      confirmLabel: cfg.confirmLabel ?? "Confirm",
      danger: cfg.danger ?? false,
      action: cfg.action,
    });
  }

  /** Direct (no-confirm) mutation that refreshes the list. */
  async function mutate(fn: () => Promise<unknown>) {
    await run(fn);
    onChange();
  }

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title={pending?.title}
      message={pending?.message ?? ""}
      confirmLabel={pending?.confirmLabel}
      danger={pending?.danger}
      loading={loading}
      onConfirm={confirm}
      onCancel={() => setPending(null)}
    />
  );

  return { dialog, remove, ask, mutate, busy: loading };
}
