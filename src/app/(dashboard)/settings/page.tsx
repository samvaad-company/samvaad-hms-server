"use client";

/**
 * Settings → Profile & branding: the hospital's theme colour (applied across the app for everyone at the
 * hospital) and its clinic profile. Anyone signed in can see this page; only admins can change it.
 */
import { useState } from "react";
import { Check, Pencil, Settings as SettingsIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow } from "@/components/shared/FormRow";
import { THEME_COLORS, applyTheme } from "@/lib/theme";

interface HospitalSettings {
  name: string; regNumber: string; gstNumber: string; panNumber: string;
  address: string; city: string; state: string; pincode: string;
  phone: string; mobile: string; email: string; website: string;
  themeColor: string;
}

const TABS = ["Profile & branding"] as const;

function Value({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-[2px] min-w-0">
      <span className="text-[14px] font-medium text-[color:var(--ink)]">{label}</span>
      <span className={`text-[14px] break-words ${value?.trim() ? "text-[color:var(--ink)]" : "text-[color:var(--ink-soft)]"}`}>{value?.trim() || "Not set"}</span>
    </div>
  );
}

function Card({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[12px] p-5 flex flex-col gap-4">
      <span className="text-[12px] text-[color:var(--ink-soft)]">{eyebrow}</span>
      {children}
    </section>
  );
}

function ThemePicker({ current, canEdit, onChanged }: { current: string; canEdit: boolean; onChanged: () => void }) {
  const { run, error } = useMutation();
  const [message, setMessage] = useState<string | null>(null);

  async function choose(key: string) {
    if (!canEdit || key === current) return;
    setMessage(null);
    applyTheme(key); // the whole app recolours straight away
    try {
      await run(() => api.put("/admin/settings", { themeColor: key }));
      setMessage("Saved — everyone at your hospital now sees this colour.");
      onChanged();
    } catch {
      applyTheme(current); // the change was refused: put the old colour back
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[16px] font-medium text-[color:var(--ink)]">Theme colour</h3>
      <p className="text-[13px] text-[color:var(--ink-soft)] max-w-[620px]">
        The colour of buttons, links and the sidebar on every screen, for everyone at your hospital. Alerts keep their own colours.
      </p>
      <div role="radiogroup" aria-label="Theme colour" className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-x-1 gap-y-2 -mx-2">
        {THEME_COLORS.map(c => {
          const selected = c.key === current;
          return (
            <button key={c.key} type="button" role="radio" aria-checked={selected} aria-label={c.label} disabled={!canEdit}
              onClick={() => choose(c.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-[10px] border-2 transition-colors ${
                selected ? "border-[color:var(--brand-ring)] bg-[color:var(--brand-soft)]" : "border-transparent hover:bg-[color:var(--subtle)]"
              } ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center ${selected ? "ring-2 ring-offset-2 ring-[color:var(--ink)]" : ""}`} style={{ background: c.hex }}>
                {selected && <Check size={16} strokeWidth={2.5} className="text-white" />}
              </span>
              <span className="text-[12px] text-[color:var(--ink-soft)]">{c.label}</span>
            </button>
          );
        })}
      </div>
      {!canEdit && <p className="text-[12px] text-[color:var(--ink-soft)]">Only an administrator can change the theme colour.</p>}
      {error && <p className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
      {message && !error && <p className="text-[13px] text-[#00955c]">{message}</p>}
    </div>
  );
}

const PROFILE_FIELDS: { key: keyof HospitalSettings; label: string; span?: boolean }[] = [
  { key: "name", label: "Clinic name", span: true },
  { key: "regNumber", label: "Registration no." },
  { key: "gstNumber", label: "GST no." },
  { key: "panNumber", label: "PAN" },
  { key: "address", label: "Address", span: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
];

/** Mounted only while open, so it always starts from the saved profile. */
function EditProfile({ settings, onClose, onSaved }: { settings: HospitalSettings; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, settings[f.key] ?? ""])));

  async function save() {
    await run(() => api.put("/admin/settings", form));
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Edit clinic profile" width={620}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading || form.name.trim().length < 2}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : "Save changes"}
          </button>
        </>
      }>
      <div className="grid grid-cols-2 gap-4">
        {PROFILE_FIELDS.map(f => (
          <div key={f.key} className={f.span ? "col-span-2" : ""}>
            <FormRow label={f.label}><FormInput value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} /></FormRow>
          </div>
        ))}
        {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  const canEdit = can("admin", "write");
  const { item: settings, loading, reload } = useItem<HospitalSettings>("/admin/settings");
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [editing, setEditing] = useState(false);

  return (
    <div className="min-h-full bg-[color:var(--surface)]">
      <div className="flex items-center gap-3 px-6 h-[52px] border-b border-[color:var(--line)]">
        <SettingsIcon size={16} strokeWidth={1.5} className="text-[color:var(--ink-soft)]" />
        <h1 className="text-[15px] font-medium text-[color:var(--ink)]">Settings</h1>
      </div>

      <div className="px-6 border-b border-[color:var(--line)] flex gap-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-4 text-[14px] border-b-2 transition-colors cursor-pointer ${tab === t ? "border-[color:var(--brand)] text-[color:var(--ink)]" : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-[760px] flex flex-col gap-5">
        {loading || !settings ? (
          <p className="text-[14px] text-[color:var(--ink-soft)]">Loading settings…</p>
        ) : (
          <>
            <Card eyebrow="Branding">
              <ThemePicker current={settings.themeColor} canEdit={canEdit} onChanged={reload} />
            </Card>

            <div className="flex items-center justify-between mt-2">
              <h2 className="text-[14px] font-medium text-[color:var(--ink)]">Clinic profile</h2>
              {canEdit && (
                <button onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-3 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">
                  <Pencil size={14} strokeWidth={1.5} /> Edit
                </button>
              )}
            </div>

            <Card eyebrow="Identity">
              <Value label="Clinic name" value={settings.name} />
              <div className="grid grid-cols-2 gap-5">
                <Value label="Registration no." value={settings.regNumber} />
                <Value label="GST no." value={settings.gstNumber} />
                <Value label="PAN" value={settings.panNumber} />
              </div>
            </Card>

            <Card eyebrow="Address & contact">
              <Value label="Address" value={settings.address} />
              <div className="grid grid-cols-2 gap-5">
                <Value label="City" value={settings.city} />
                <Value label="State" value={settings.state} />
                <Value label="Pincode" value={settings.pincode} />
                <Value label="Phone" value={settings.phone} />
                <Value label="Mobile" value={settings.mobile} />
                <Value label="Email" value={settings.email} />
                <Value label="Website" value={settings.website} />
              </div>
            </Card>
          </>
        )}
      </div>

      {editing && settings && <EditProfile settings={settings} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
