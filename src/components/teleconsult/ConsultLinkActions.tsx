"use client";

/**
 * The video side of a tele-consult appointment: a Join button once the link
 * exists, and — for staff who can write — ways to create or paste one when it
 * doesn't (Google Meet not connected, or the automatic creation failed).
 */
import { useState } from "react";
import { Check, Copy, Link2, Loader2, Video } from "lucide-react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow } from "@/components/shared/FormRow";
import type { AppointmentDTO } from "@/types/api";

export function ConsultLinkActions({
  appt, canWrite, onChanged,
}: {
  appt: AppointmentDTO;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createMeet(replace = false) {
    setBusy(true);
    setError(null);
    try {
      const row = await api.post<AppointmentDTO>(`/teleconsult/${appt.id}/meet`, { replace });
      if (!row.videoUrl) setError(row.meetError || "Google didn't return a Meet link.");
      else if (row.meetWarning) setError(row.meetWarning);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the link.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLink() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/teleconsult/${appt.id}/link`, { videoUrl: url });
      setAdding(false);
      setUrl("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!appt.videoUrl) return;
    try {
      await navigator.clipboard.writeText(appt.videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — the link is still one click away */ }
  }

  const closed = appt.status === "Cancelled" || appt.status === "Completed";
  // A room Google created as a calendar side effect only admits invited guests; offer to make one patients can actually join.
  const restrictedRoom = !closed && canWrite && !!appt.videoUrl && appt.videoProvider === "google_meet" && (!appt.meetAccess || appt.meetAccess === "calendar-default");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {appt.videoUrl ? (
        <>
          <a href={appt.videoUrl} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-[6px] text-[12px] px-3 py-[5px] rounded-full transition-colors ${
              closed ? "text-[color:var(--ink-soft)] border border-[color:var(--line)] hover:bg-[color:var(--subtle)]" : "text-white bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"
            }`}>
            <Video size={13} /> Join
          </a>
          {restrictedRoom && (
            <button type="button" onClick={() => createMeet(true)} disabled={busy}
              title="This link only admits invited guests, so a patient may see “You can't join this video call”. Make a new one anyone with the link can join."
              className="inline-flex items-center gap-[5px] text-[12px] text-[#ff9000] border border-[#ff9000] px-3 py-[5px] rounded-full hover:bg-[#fff2e0] transition-colors disabled:opacity-60 cursor-pointer">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />} Recreate link
            </button>
          )}
          <button type="button" onClick={copy} aria-label="Copy video link"
            className="inline-flex items-center gap-[5px] text-[12px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[5px] rounded-full hover:bg-[color:var(--subtle)] transition-colors cursor-pointer">
            {copied ? <Check size={13} className="text-[#00955c]" /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </button>
        </>
      ) : closed ? (
        <span className="text-[12px] text-[color:var(--ink-soft)]">No link</span>
      ) : (
        <>
          <span className="text-[12px] text-[#ff9000]" title={appt.meetError ?? undefined}>Link pending</span>
          {canWrite && (
            <>
              <button type="button" onClick={() => createMeet()} disabled={busy}
                className="inline-flex items-center gap-[5px] text-[12px] text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors disabled:opacity-60 cursor-pointer">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />} Create Meet
              </button>
              <button type="button" onClick={() => { setError(null); setAdding(true); }}
                className="inline-flex items-center gap-[5px] text-[12px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[5px] rounded-full hover:bg-[color:var(--subtle)] transition-colors cursor-pointer">
                <Link2 size={13} /> Add link
              </button>
            </>
          )}
        </>
      )}
      {error && !adding && <span className="text-[11px] text-[#ff0004] w-full">{error}</span>}
      {!error && appt.meetWarning && appt.videoUrl && <span className="text-[11px] text-[#ff9000] w-full">{appt.meetWarning}</span>}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add video link" width={460}
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setAdding(false)} className="text-[13px] text-[color:var(--ink-soft)] px-4 py-[8px] rounded-full border border-[color:var(--line)] cursor-pointer">Cancel</button>
            <button onClick={saveLink} disabled={busy || !url.trim()}
              className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
              {busy ? "Saving…" : "Save link"}
            </button>
          </div>
        }>
        <FormRow label="Meeting link" hint="Paste a Google Meet, Zoom or similar link. The patient sees it in their app.">
          <FormInput placeholder="https://meet.google.com/abc-defg-hij" value={url} onChange={setUrl} />
        </FormRow>
        {error && <p className="mt-3 text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</p>}
      </Modal>
    </div>
  );
}
