"use client";

import { Modal } from "@/components/shared/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation dialog for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <button
            onClick={onCancel}
            className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`text-[13px] font-normal text-white px-5 py-[8px] rounded-full transition-colors disabled:opacity-50 ${
              danger ? "bg-[#ff0004] hover:bg-[#d60003]" : "bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[14px] font-normal text-[color:var(--ink)] leading-[20px]">{message}</p>
    </Modal>
  );
}
