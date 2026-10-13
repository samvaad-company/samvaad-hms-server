"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";

interface MyProfile {
  name: string;
  email: string;
  role: string;
  phone: string;
  specialty?: string;
  experience?: string;
  department?: string;
}

/** "My profile": every signed-in user edits their own details here (role, email and status stay with admins). */
export function MyProfileModal(props: { open: boolean; onClose: () => void }) {
  return props.open ? <MyProfile {...props} /> : null; // mounted only while open, so it starts clean each time
}

function MyProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAuth();
  const { run, loading, error } = useMutation();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", experience: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [mismatch, setMismatch] = useState(false);
  const [saved, setSaved] = useState(false);
  const isDoctor = profile?.specialty !== undefined;

  useEffect(() => {
    api.get<MyProfile>("/auth/profile").then((p) => {
      setProfile(p);
      setForm({ name: p.name, phone: p.phone ?? "", specialty: p.specialty ?? "", experience: p.experience ?? "" });
    }).catch(() => setProfile(null));
  }, []);

  async function save() {
    setSaved(false);
    if (pw.next && pw.next !== pw.confirm) { setMismatch(true); return; }
    setMismatch(false);
    const body: Record<string, string> = { name: form.name, phone: form.phone };
    if (isDoctor) { body.specialty = form.specialty; body.experience = form.experience; }
    if (pw.next) { body.currentPassword = pw.current; body.newPassword = pw.next; }
    await run(() => api.patch("/auth/profile", body));
    await refresh();
    setPw({ current: "", next: "", confirm: "" });
    setSaved(true);
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="My profile"
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Close</button>
          <button onClick={save} disabled={loading || !profile || !form.name.trim()}
            className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {!profile ? (
        <div className="py-8 text-center text-[13px] text-[#57575f]">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormRow label="Full Name *"><FormInput value={form.name} onChange={(v) => set("name", v)} /></FormRow></div>
          <FormRow label="Email" hint="Ask an administrator to change this."><FormInput value={profile.email} disabled /></FormRow>
          <FormRow label="Role" hint="Set by your administrator."><FormInput value={profile.role} disabled /></FormRow>
          <FormRow label="Phone"><FormInput type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={(v) => set("phone", v)} /></FormRow>
          {isDoctor && <FormRow label="Experience"><FormInput placeholder="e.g. 10 yrs" value={form.experience} onChange={(v) => set("experience", v)} /></FormRow>}
          {isDoctor && <div className="col-span-2"><FormRow label="Specialty"><FormInput value={form.specialty} onChange={(v) => set("specialty", v)} /></FormRow></div>}

          <div className="col-span-2 h-px bg-[#f0f0f0]" />
          <div className="col-span-2 text-[12px] font-medium text-[#57575f] uppercase tracking-wider -mb-2">Change password (optional)</div>
          <div className="col-span-2"><FormRow label="Current password"><FormInput type="password" value={pw.current} onChange={(v) => setPw((p) => ({ ...p, current: v }))} /></FormRow></div>
          <FormRow label="New password" hint="At least 6 characters."><FormInput type="password" value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} /></FormRow>
          <FormRow label="Confirm new password"><FormInput type="password" error={mismatch} value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} /></FormRow>

          {mismatch && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">The new passwords don&apos;t match.</div>}
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
          {saved && !error && <div className="col-span-2 text-[13px] text-[#007f4f] bg-[#e6f6ee] rounded-[8px] px-3 py-2">Saved.</div>}
        </div>
      )}
    </Modal>
  );
}
