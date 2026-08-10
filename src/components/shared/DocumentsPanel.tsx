"use client";

/**
 * Reusable document attachments panel.
 *
 * Lists, uploads, views and deletes files attached to any record (patient,
 * lab test, donor, …). Storage is handled server-side, so this component only
 * deals with metadata plus a download URL.
 */
import { useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, Download } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import type { DocumentDTO } from "@/types/api";

interface DocumentsPanelProps {
  ownerType: "patient" | "lab" | "radiology" | "donor" | "staff";
  ownerId: number;
  /** Suggested categories offered in the upload control. */
  categories?: string[];
}

const DEFAULT_CATEGORIES = [
  "ID Proof",
  "Insurance",
  "Medical History",
  "Report",
  "Consent Form",
  "Other",
];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsPanel({ ownerType, ownerId, categories = DEFAULT_CATEGORIES }: DocumentsPanelProps) {
  const { items, reload, loading } = useList<DocumentDTO>("/documents", {
    all: true,
    owner_type: ownerType,
    owner_id: ownerId,
  });
  const { run } = useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("ownerType", ownerType);
      form.append("ownerId", String(ownerId));
      form.append("category", category);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: number) {
    await run(() => api.del(`/documents/${id}`));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-3">
      {loading && items.length === 0 && (
        <p className="text-[13px] font-light text-[#57575f]">Loading documents…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-[13px] font-light text-[#57575f]">No documents uploaded yet.</p>
      )}

      {items.map((d) => (
        <div key={d.id} className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#f0f0f0] rounded-[8px] flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#57575f]" />
            </div>
            <div className="min-w-0">
              <span className="text-[14px] font-medium text-[#11111c] block truncate">{d.fileName}</span>
              <span className="text-[12px] font-light text-[#57575f]">
                {d.category} · {humanSize(d.sizeBytes)} · {d.uploadedBy}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors inline-flex items-center gap-1"
            >
              <Download size={12} /> View
            </a>
            <button
              onClick={() => remove(d.id)}
              className="text-[#c8c8cc] hover:text-[#ff0004] transition-colors p-1"
              aria-label={`Delete ${d.fileName}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {error && (
        <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-[13px] text-[#11111c] border border-[#dedee1] rounded-[8px] px-3 py-2 outline-none focus:border-[#009598] bg-white"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-[#dedee1] rounded-[10px] py-3 text-[13px] font-normal text-[#57575f] hover:bg-[#f6f6f6] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
      </div>
      <p className="text-[11px] font-light text-[#57575f]">PDF, PNG, JPEG, WebP or HEIC · up to 10 MB</p>
    </div>
  );
}
