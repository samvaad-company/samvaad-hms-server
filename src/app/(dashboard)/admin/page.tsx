"use client";

import { useEffect, useState } from "react";
import { tw } from "@/lib/design-system";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { Modal } from "@/components/shared/Modal";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import type { DepartmentDTO, AdminUserDTO, RadiologyLinkDTO, LabLinkDTO, StaffDTO, TeleconsultConfigDTO, DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Trash2, Edit2, Settings2, Save, Loader2, Link2, LocateFixed, Video } from "lucide-react";

interface HospitalSettings {
  name: string; address: string; city: string; state: string; pincode: string;
  phone: string; mobile: string; email: string; website: string;
  gstNumber: string; panNumber: string; regNumber: string;
  latitude: number | null; longitude: number | null; geofenceRadiusM: number;
  teleconsultEnabled: boolean; teleconsultPrice: number | null; teleconsultMeetAccess: "OPEN" | "TRUSTED" | "RESTRICTED";
}

// ─── Video consultations (tele-consult) ───────────────────────────────────────

const GOOGLE_NOTICE: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Google account connected — new video consultations will get a Meet link automatically.", ok: true },
  denied:    { text: "Google sign-in was cancelled, so nothing was connected.", ok: false },
  error:     { text: "Couldn't finish connecting Google. Try again, and make sure you approve calendar access.", ok: false },
  scope:     { text: "Google was connected WITHOUT calendar access, so it wasn't saved. Click Connect Google again and leave the \"See, edit, share, and permanently delete calendars\" / Calendar permission ticked on Google's screen.", ok: false },
};

function TeleconsultSettings({
  form, setForm, canEdit,
}: {
  form: HospitalSettings;
  setForm: React.Dispatch<React.SetStateAction<HospitalSettings | null>>;
  canEdit: boolean;
}) {
  const { item: cfg, reload } = useItem<TeleconsultConfigDTO>("/teleconsult/config");
  const { run, loading } = useMutation();
  const [notice] = useState(() => {
    if (typeof window === "undefined") return null;
    const result = new URLSearchParams(window.location.search).get("google");
    return result ? GOOGLE_NOTICE[result] ?? null : null;
  });

  const google = cfg?.google;
  return (
    <section>
      <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-1 flex items-center gap-2"><Video size={15} /> Video consultations</h3>
      <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-4">
        Patients book a paid video consultation from the patient app. The fee below is what they are charged — it is
        decided here, never by the app. {canEdit ? "" : "Only a Super Admin can change the fee or switch this on or off."}
      </p>
      <div className="grid grid-cols-3 gap-4 items-end">
        <FormRow label="Consultation fee (₹)" hint="Charged per video consultation">
          <FormInput type="number" placeholder="e.g. 500" value={form.teleconsultPrice?.toString() ?? ""}
            onChange={v => canEdit && setForm(prev => (prev ? { ...prev, teleconsultPrice: v === "" ? null : Math.max(0, Number(v)) } : prev))} />
        </FormRow>
        <label className={`flex items-center gap-3 h-[40px] ${canEdit ? "cursor-pointer" : "opacity-60"}`}>
          <button type="button" role="switch" aria-checked={form.teleconsultEnabled} disabled={!canEdit}
            onClick={() => setForm(prev => (prev ? { ...prev, teleconsultEnabled: !prev.teleconsultEnabled } : prev))}
            className={`w-[42px] h-[24px] rounded-full transition-colors relative shrink-0 ${form.teleconsultEnabled ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"}`}>
            <span className={`absolute top-[3px] w-[18px] h-[18px] bg-[color:var(--surface)] rounded-full shadow transition-all ${form.teleconsultEnabled ? "left-[21px]" : "left-[3px]"}`} />
          </button>
          <span className="text-[13px] text-[color:var(--ink)]">{form.teleconsultEnabled ? "Accepting bookings" : "Switched off"}</span>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FormRow label="Who can join the video call" hint={
          form.teleconsultMeetAccess === "OPEN" ? "Anyone with the patient's link joins straight away — works whatever Google account (or none) the patient uses."
          : form.teleconsultMeetAccess === "TRUSTED" ? "People in your Google organization and invited guests join directly; everyone else (e.g. a patient) has to ask to join and be let in by someone in your organization."
          : "Only invited guests join directly; everyone else has to ask to join and be let in by the host account."
        }>
          <FormSelect value={form.teleconsultMeetAccess ?? "OPEN"} disabled={!canEdit}
            onChange={v => canEdit && setForm(prev => (prev ? { ...prev, teleconsultMeetAccess: v as HospitalSettings["teleconsultMeetAccess"] } : prev))}
            options={[
              { value: "OPEN", label: "Anyone with the link" },
              { value: "TRUSTED", label: "Ask to join (organization & invitees skip)" },
              { value: "RESTRICTED", label: "Invitees only, others ask to join" },
            ]} />
        </FormRow>
      </div>
      {google?.configured && google.connected && !google.meetAccessControl && (
        <p className="mt-3 text-[12px] text-[#ff9000] bg-[#fff2e0] rounded-[8px] px-3 py-2">
          This Google connection was made before call-access control existed, so calls use Google&apos;s default (invited guests only) and patients may see
          &ldquo;You can&apos;t join this video call&rdquo;. Click Reconnect below, keep every permission ticked, and make sure the <b>Google Meet REST API</b> is enabled in your Google Cloud project.
        </p>
      )}

      <div className="mt-4 border border-[color:var(--line)] rounded-[10px] p-4 flex items-center gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Google Meet</p>
          <p className="text-[12px] font-light text-[color:var(--ink-soft)]">
            {!google ? "Checking…"
              : !google.configured ? "Google isn't set up on this server yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Until then, staff can paste a link by hand."
              : google.needsReconnect ? `Google needs to be reconnected${google.accountEmail ? ` (${google.accountEmail})` : ""}: ${google.lastError ?? "access was revoked or never granted"}.`
              : google.connected ? `Connected${google.accountEmail ? ` as ${google.accountEmail}` : ""}. Meet links are created on this account's calendar.`
              : "Not connected. Connect the Google account that should host the Meet links."}
          </p>
        </div>
        {google?.configured && google.connected && !google.needsReconnect && !google.meetAccessControl && (
          <a href="/api/teleconsult/google/connect"
            className="text-[13px] text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors">
            Reconnect Google
          </a>
        )}
        {google?.configured && (google.connected && !google.needsReconnect ? (
          <button type="button" disabled={loading}
            onClick={async () => { await run(() => api.post("/teleconsult/google/disconnect")); reload(); }}
            className="text-[13px] text-[#ff0004] border border-[#ff0004] px-4 py-[7px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-60">
            Disconnect
          </button>
        ) : (
          <a href="/api/teleconsult/google/connect"
            className="text-[13px] text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors">
            {google.needsReconnect ? "Reconnect Google" : "Connect Google"}
          </a>
        ))}
      </div>
      {notice && (
        <p className={`mt-3 text-[12px] rounded-[8px] px-3 py-2 ${notice.ok ? "text-[#00955c] bg-[#dffff3]" : "text-[#ff0004] bg-[#ffe9e9]"}`}>{notice.text}</p>
      )}
      {cfg && cfg.gatewayMode !== "razorpay" && (
        <p className="mt-3 text-[12px] text-[#ff9000] bg-[#fff2e0] rounded-[8px] px-3 py-2">
          {cfg.gatewayMode === "mock"
            ? "Payments run on a mock gateway (development only). Add Razorpay keys to take real payments."
            : "Online payments aren't configured on this server — patients can't pay until Razorpay keys are added."}
        </p>
      )}
    </section>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsView() {
  const { user, can } = useAuth();
  const { item: settings } = useItem<HospitalSettings>("/admin/settings");
  const { run, loading } = useMutation();
  const [form, setForm] = useState<HospitalSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (k: keyof HospitalSettings, v: string) =>
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));
  const [geoMsg, setGeoMsg] = useState("");
  const setNum = (k: "latitude" | "longitude", v: string) =>
    setForm(prev => (prev ? { ...prev, [k]: v === "" ? null : Number(v) } : prev));

  function useMyLocation() {
    if (!navigator.geolocation) { setGeoMsg("This browser can't share its location."); return; }
    setGeoMsg("Getting location…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => (prev ? { ...prev, latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) } : prev));
        setGeoMsg(`Filled in (accurate to about ${Math.round(pos.coords.accuracy)} m) — remember to save.`);
      },
      err => setGeoMsg(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function save() {
    if (!form) return;
    setSaved(false);
    await run(() => api.put("/admin/settings", form));
    setSaved(true);
  }

  if (!form) {
    return <div className="p-8 text-[14px] text-[color:var(--ink-soft)]">Loading settings…</div>;
  }

  const FIELDS: { label: string; key: keyof HospitalSettings; ph: string }[] = [
    { label: "Hospital Name *", key: "name", ph: "Name" },
    { label: "GST Number", key: "gstNumber", ph: "GSTIN" },
    { label: "Registration Number", key: "regNumber", ph: "Reg. No." },
    { label: "Phone", key: "phone", ph: "+91 XXXXX XXXXX" },
    { label: "Email", key: "email", ph: "hospital@email.com" },
    { label: "Website", key: "website", ph: "https://" },
  ];

  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 580 }}>
      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-4">Hospital Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <FormRow key={f.key} label={f.label}>
              <FormInput value={String(form[f.key] ?? "")} placeholder={f.ph} onChange={v => set(f.key, v)} />
            </FormRow>
          ))}
          <div className="col-span-2">
            <FormRow label="Address">
              <FormInput value={form.address} placeholder="Full address" onChange={v => set("address", v)} />
            </FormRow>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-1">Attendance geofence</h3>
        <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-4">
          Staff can only mark attendance from the attendance app while their phone is inside this radius.
          Stand at the reception desk and tap &ldquo;Use my current location&rdquo; to fill it in.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Latitude">
            <FormInput type="number" placeholder="e.g. 19.0760" value={form.latitude?.toString() ?? ""}
              onChange={v => setNum("latitude", v)} />
          </FormRow>
          <FormRow label="Longitude">
            <FormInput type="number" placeholder="e.g. 72.8777" value={form.longitude?.toString() ?? ""}
              onChange={v => setNum("longitude", v)} />
          </FormRow>
          <FormRow label="Radius (metres)" hint="20 – 5000">
            <FormInput type="number" value={form.geofenceRadiusM?.toString() ?? ""}
              onChange={v => setForm(prev => (prev ? { ...prev, geofenceRadiusM: Number(v) || 150 } : prev))} />
          </FormRow>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="button" onClick={useMyLocation}
            className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-4 py-[7px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors">
            <LocateFixed size={14} /> Use my current location
          </button>
          {geoMsg && <span className="text-[12px] text-[color:var(--ink-soft)]">{geoMsg}</span>}
        </div>
      </section>

      {can("teleconsult", "read") && (
        <TeleconsultSettings form={form} setForm={setForm} canEdit={user?.role === "Super Admin" || user?.role === "Platform Admin"} />
      )}

      <div className="flex justify-end items-center gap-3">
        {saved && <span className="text-[13px] text-[#00955c]">Saved ✓</span>}
        <button onClick={save} disabled={loading}
          className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[9px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Settings
        </button>
      </div>
    </div>
  );
}

// ─── Master Data Tab ──────────────────────────────────────────────────────────

const MASTER_SECTIONS = [
  { key: "departments", label: "Departments", items: [] as string[] },
  { key: "testTypes",   label: "Lab Test Types", items: ["CBC","Lipid Profile","LFT","KFT","Thyroid Panel","HbA1c","Urine Routine","X-Ray","ECG","Ultrasound"] },
  { key: "services",    label: "Services / Procedures", items: ["Consultation","OPD Visit","ECG","Physiotherapy","Minor Surgery","IV Therapy","Dressing"] },
  { key: "wards",       label: "Wards & Rooms", items: ["General Ward","ICU","Cardiology","Surgery Ward","Maternity"] },
  { key: "insurers",    label: "Insurance Companies", items: ["Star Health","New India Assurance","HDFC Ergo","Bajaj Allianz","ICICI Lombard","United India"] },
];

function MasterDataView() {
  const { items: departments, reload } = useList<DepartmentDTO>("/departments");
  const [activeSection, setActiveSection] = useState("departments");
  const [items, setItems] = useState<Record<string, string[]>>(
    Object.fromEntries(MASTER_SECTIONS.map(s => [s.key, s.items]))
  );
  const [newItem, setNewItem] = useState("");
  const section = MASTER_SECTIONS.find(s => s.key === activeSection)!;
  const currentItems =
    activeSection === "departments" ? departments.map(d => d.name) : (items[activeSection] ?? []);

  const addItem = async () => {
    if (!newItem.trim()) return;
    if (activeSection === "departments") {
      await api.post("/departments", { name: newItem.trim() });
      reload();
    } else {
      setItems(prev => ({ ...prev, [activeSection]: [...(prev[activeSection] ?? []), newItem.trim()] }));
    }
    setNewItem("");
  };
  const removeItem = async (item: string) => {
    if (activeSection === "departments") {
      const dept = departments.find(d => d.name === item);
      if (dept) { await api.del(`/departments/${dept.id}`); reload(); }
    } else {
      setItems(prev => ({ ...prev, [activeSection]: prev[activeSection].filter(i => i !== item) }));
    }
  };

  return (
    <div className="flex overflow-hidden" style={{ height: 580 }}>
      {/* Left: section list */}
      <div className="w-52 border-r border-[color:var(--line)] flex flex-col gap-1 p-3 shrink-0">
        {MASTER_SECTIONS.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`text-left px-4 py-[9px] rounded-[8px] text-[13px] font-normal transition-colors ${activeSection === s.key ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)]"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {/* Right: items */}
      <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">
        <h3 className="text-[14px] font-medium text-[color:var(--ink)]">{section.label}</h3>
        {/* Add new */}
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder={`Add new ${section.label.toLowerCase().replace(/s$/, "")}...`}
            className="flex-1 h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
          />
          <button onClick={addItem}
            className="flex items-center gap-1 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-[8px] hover:bg-[color:var(--brand-hover)] transition-colors whitespace-nowrap">
            <Plus size={14} /> Add
          </button>
        </div>
        {/* Items */}
        <div className="flex flex-col gap-2">
          {currentItems.map(item => (
            <div key={item} className="flex items-center justify-between p-3 border border-[color:var(--line)] rounded-[8px] bg-[color:var(--surface)] hover:bg-[color:var(--faint)] transition-colors">
              <span className="text-[13px] font-normal text-[color:var(--ink)]">{item}</span>
              <div className="flex items-center gap-2">
                <button className="text-[color:var(--ink-soft)] hover:text-[color:var(--brand)] transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => removeItem(item)} className="text-[color:var(--ink-soft)] hover:text-[#ff0004] transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_CLR: Record<string, string> = {
  Administrator: "bg-[#ffe9e9] text-[#ff0004]",
  Doctor:        "bg-[#d6eaff] text-[#007cff]",
  Nurse:         "bg-[#dffff3] text-[#00955c]",
  Receptionist:  "bg-[#fff2e0] text-[#ff9000]",
  Accountant:    "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
};

/** A readable random password (no look-alike characters) for the admin to hand over. */
function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => chars[b % chars.length]).join("") + "#7";
}

const ROLE_OPTIONS = ["Super Admin","Doctor","Head Nurse","Receptionist","Tele Caller","Billing Exec","Lab Technician","Pharmacist","IT Admin","MRD Officer","CSSD Technician","HR Manager","Radiology Partner","Lab Partner"];

function ChangeRoleModal({ user, onClose, onSaved }: { user: AdminUserDTO; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [role, setRole] = useState(user.role);

  async function save() {
    if (role === user.role) { onClose(); return; }
    await run(() => api.patch(`/admin/users/${user.id}`, { role }));
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change Role — ${user.name}`}
      width={420}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : "Save Role"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormRow label="Role">
          <FormSelect value={role} onChange={setRole} options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))} />
        </FormRow>
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

function LinkStaffModal({ user, onClose, onSaved }: { user: AdminUserDTO; onClose: () => void; onSaved: () => void }) {
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const { run, loading, error } = useMutation();
  const [staffId, setStaffId] = useState(user.staffId ? String(user.staffId) : "");

  async function save() {
    await run(() => api.patch(`/admin/users/${user.id}`, { staffId: staffId ? Number(staffId) : 0 }));
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Link staff record — ${user.name}`}
      width={460}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : "Save Link"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          The attendance app records punches against this staff member whenever {user.name} scans in.
        </p>
        <FormRow label="Staff member">
          <FormSelect value={staffId} onChange={setStaffId}
            options={[{ value: "", label: "Not linked" }, ...staff.map(s => ({ value: String(s.id), label: `${s.name} — ${s.role}` }))]} />
        </FormRow>
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: AdminUserDTO; onClose: () => void }) {
  const { run, loading, error } = useMutation();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    await run(() => api.patch(`/admin/users/${user.id}`, { password }));
    setDone(true);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password — ${user.name}`}
      width={440}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">{done ? "Close" : "Cancel"}</button>
          {!done && (
            <button onClick={save} disabled={loading || password.length < 6}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {loading ? "Saving…" : "Set password"}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          Their old password stops working straight away. Share the new one with {user.name} — nothing is emailed.
        </p>
        <FormRow label="New password" hint="At least 6 characters.">
          <div className="flex gap-2">
            <FormInput value={password} onChange={setPassword} placeholder="New password" />
            <button type="button" onClick={() => setPassword(generatePassword())} className="shrink-0 text-[12px] text-[color:var(--brand)] border border-[color:var(--line)] px-3 rounded-[8px] hover:bg-[color:var(--subtle)]">Generate</button>
          </div>
        </FormRow>
        {done && <div className="text-[13px] text-[#007f4f] bg-[#e6f6ee] rounded-[8px] px-3 py-2">Password updated.</div>}
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

function LinkDoctorModal({ user, onClose, onSaved }: { user: AdminUserDTO; onClose: () => void; onSaved: () => void }) {
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: users } = useList<AdminUserDTO>("/admin/users");
  const { run, loading, error } = useMutation();
  const [doctorId, setDoctorId] = useState(user.doctorId ? String(user.doctorId) : "");
  const taken = new Set(users.filter(u => u.doctorId && u.id !== user.id).map(u => u.doctorId));

  async function save() {
    await run(() => api.patch(`/admin/users/${user.id}`, { doctorId: doctorId ? Number(doctorId) : 0 }));
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Linked doctor — ${user.name}`}
      width={460}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : "Save Link"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          Links this login to a doctor record, so {user.name} gets their own schedule, appointments and profile.
        </p>
        <FormRow label="Doctor">
          <FormSelect value={doctorId} onChange={setDoctorId}
            options={[{ value: "", label: "Not linked" }, ...doctors.filter(d => !taken.has(d.id)).map(d => ({ value: String(d.id), label: `${d.name} — ${d.specialty}` }))]} />
        </FormRow>
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

function UsersView() {
  const { items: adminUsers, reload } = useList<AdminUserDTO>("/admin/users");
  const { items: departments } = useList<DepartmentDTO>("/departments");
  const { run, loading, error } = useMutation();
  const [showForm, setShowForm] = useState(false);
  const { items: staffList } = useList<StaffDTO>("/staff", { all: true });
  const { items: doctorList } = useList<DoctorDTO>("/doctors", { all: true });
  const EMPTY_FORM = { name: "", email: "", password: "", role: "", departmentId: "", staffId: "", doctorId: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetting, setResetting] = useState<AdminUserDTO | null>(null);
  const [linkingDoctor, setLinkingDoctor] = useState<AdminUserDTO | null>(null);
  const [changingRole, setChangingRole] = useState<AdminUserDTO | null>(null);
  const [linkingStaff, setLinkingStaff] = useState<AdminUserDTO | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const linkedDoctorIds = new Set(adminUsers.map(u => u.doctorId).filter(Boolean));

  async function createUser() {
    await run(() =>
      api.post("/admin/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        staffId: form.staffId ? Number(form.staffId) : undefined,
        doctorId: form.role === "Doctor" && form.doctorId ? Number(form.doctorId) : undefined,
      }),
    );
    setCreated({ email: form.email, password: form.password });
    setForm(EMPTY_FORM);
    setShowForm(false);
    reload();
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 580 }}>
      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--line)]">
        <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{adminUsers.length} users total</span>
        <button onClick={() => { setCreated(null); setShowForm(v => !v); }}
          className="flex items-center gap-1 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[7px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors">
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-[color:var(--line)] bg-[color:var(--subtle)]">
          <div className="grid grid-cols-4 gap-3">
            <FormRow label={form.role === "Radiology Partner" ? "Radiology Centre Name *" : form.role === "Lab Partner" ? "Lab Name *" : "Full Name *"}>
              <FormInput placeholder={form.role === "Radiology Partner" ? "e.g. Scanwell Diagnostics" : form.role === "Lab Partner" ? "e.g. Pathcare Diagnostics" : "Name"} value={form.name} onChange={v => set("name", v)} />
            </FormRow>
            <FormRow label="Email *"><FormInput placeholder="email@hospital.com" type="email" value={form.email} onChange={v => set("email", v)} /></FormRow>
            <FormRow label="Role *">
              <FormSelect placeholder="Select role" value={form.role} onChange={v => set("role", v)} options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))} />
            </FormRow>
            <FormRow label="Department">
              <FormSelect placeholder="Select dept" value={form.departmentId} onChange={v => set("departmentId", v)} options={departments.map(d => ({ value: String(d.id), label: d.name }))} />
            </FormRow>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            <FormRow label="Password *" hint="At least 6 characters. You give it to them — nothing is emailed.">
              <div className="flex gap-2">
                <FormInput placeholder="Set a password" value={form.password} onChange={v => set("password", v)} />
                <button type="button" onClick={() => set("password", generatePassword())} className="shrink-0 text-[12px] text-[color:var(--brand)] border border-[color:var(--line)] px-3 rounded-[8px] hover:bg-[color:var(--surface)]">Generate</button>
              </div>
            </FormRow>
            <FormRow label="Staff record" hint="For attendance punches.">
              <FormSelect placeholder="Not linked" value={form.staffId} onChange={v => set("staffId", v)}
                options={[{ value: "", label: "Not linked" }, ...staffList.map(st => ({ value: String(st.id), label: `${st.name} — ${st.role}` }))]} />
            </FormRow>
            {form.role === "Doctor" && (
              <FormRow label="Linked doctor" hint="Gives them their own schedule and appointments.">
                <FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => set("doctorId", v)}
                  options={[{ value: "", label: "Not linked" }, ...doctorList.filter(d => !linkedDoctorIds.has(d.id)).map(d => ({ value: String(d.id), label: `${d.name} — ${d.specialty}` }))]} />
              </FormRow>
            )}
          </div>
          {form.role === "Radiology Partner" && (
            <p className="text-[12px] font-light text-[color:var(--ink-soft)] mt-2">
              Partner centres get their own login and see only the Radiology worklist — reports they upload
              appear instantly in this hospital&apos;s Radiology panel.
            </p>
          )}
          {form.role === "Lab Partner" && (
            <p className="text-[12px] font-light text-[color:var(--ink-soft)] mt-2">
              Partner labs get their own login and see only the in-house Lab worklist — reports they upload
              appear instantly in this hospital&apos;s Lab panel.
            </p>
          )}
          {error && <p className="text-[12px] text-[#ff0004] mt-2">{error.message}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={createUser} disabled={loading || !form.name || !form.email || !form.role || form.password.length < 6}
              className="text-[12px] font-normal text-white bg-[color:var(--brand)] px-4 py-[7px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {loading ? "Creating…" : "Create User"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-[7px] rounded-full hover:bg-[color:var(--surface)] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {created && (
        <div className="px-5 py-3 border-b border-[color:var(--line)] bg-[#e6f6ee] text-[13px] text-[color:var(--ink)] flex items-center justify-between gap-3">
          <span>User created. Share these with them — no email is sent: <b>{created.email}</b> / <b className="font-mono">{created.password}</b></span>
          <button onClick={() => setCreated(null)} className="text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">Dismiss</button>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-y-auto flex-1">
        <div className="relative h-10 bg-[color:var(--subtle-3)]" style={{ minWidth: 980 }}>
          {[{ l: "Name", x: 20 }, { l: "Role", x: 250 }, { l: "Email", x: 440 }, { l: "Last Login", x: 700 }, { l: "Status", x: 880 }, { l: "Actions", x: 940 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[13px] font-medium text-[color:var(--ink)] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {adminUsers.map(u => {
          const actions: RowAction[] = [
            { label: "Change Role", onClick: () => setChangingRole(u) },
            { label: "Reset password", onClick: () => setResetting(u) },
            { label: u.staffId ? "Change linked staff" : "Link staff record", onClick: () => setLinkingStaff(u) },
            ...(u.role === "Doctor" ? [{ label: u.doctorId ? "Change linked doctor" : "Link doctor record", onClick: () => setLinkingDoctor(u) }] : []),
          ];
          return (
            <div key={u.id} className="relative flex items-center h-[60px] border-b border-[color:var(--subtle-2)] last:border-0 hover:bg-[color:var(--faint)] transition-colors" style={{ minWidth: 980 }}>
              <div className="absolute flex flex-col" style={{ left: 20 }}>
                <span className="text-[14px] font-medium text-[color:var(--ink)] whitespace-nowrap">{u.name}</span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)]">{u.department}</span>
              </div>
              <span className={`absolute inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${ROLE_CLR[u.role] ?? "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`} style={{ left: 250 }}>{u.role}</span>
              <span className="absolute text-[13px] font-normal text-[color:var(--ink-soft)] whitespace-nowrap" style={{ left: 440 }}>{u.email}</span>
              <span className="absolute text-[13px] font-normal text-[color:var(--ink-soft)] whitespace-nowrap" style={{ left: 700 }}>{u.lastLogin}</span>
              <div className="absolute" style={{ left: 880 }}><StatusBadge status={u.status} /></div>
              <div className="absolute" style={{ left: 940 }}><RowMenu actions={actions} /></div>
            </div>
          );
        })}
      </div>

      {changingRole && (
        <ChangeRoleModal user={changingRole} onClose={() => setChangingRole(null)} onSaved={reload} />
      )}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
      {linkingDoctor && (
        <LinkDoctorModal user={linkingDoctor} onClose={() => setLinkingDoctor(null)} onSaved={reload} />
      )}
      {linkingStaff && (
        <LinkStaffModal user={linkingStaff} onClose={() => setLinkingStaff(null)} onSaved={reload} />
      )}
    </div>
  );
}

// ─── Radiology Links Tab ────────────────────────────────────────────────────

const ACTIVE_LINK_STATUSES = ["Pending", "Active"];

function RadiologyLinksView() {
  const { items: links, reload, loading } = useList<RadiologyLinkDTO>("/radiology-links");
  const { run, loading: saving, error, reset } = useMutation();
  const [code, setCode] = useState("");

  async function requestLink() {
    if (!code.trim()) return;
    await run(() => api.post("/radiology-links", { radiologyCenterCode: code.trim() }));
    setCode("");
    reload();
  }

  async function revoke(id: number) {
    await run(() => api.post(`/radiology-links/${id}/revoke`, {}));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-5 overflow-y-auto" style={{ height: 580 }}>
      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-2">Link a Radiology Center</h3>
        <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-3">
          Enter the center&apos;s code (shared with you by the center) to send a link request.
          Once their admin accepts, orders can be routed there and their reports flow back here.
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            value={code}
            onChange={e => { setCode(e.target.value); reset(); }}
            onKeyDown={e => e.key === "Enter" && requestLink()}
            placeholder="e.g. RADC-0001"
            className="flex-1 h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
          />
          <button onClick={requestLink} disabled={saving || !code.trim()}
            className="flex items-center gap-1 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-[8px] hover:bg-[color:var(--brand-hover)] transition-colors whitespace-nowrap disabled:opacity-50">
            <Link2 size={14} /> Request Link
          </button>
        </div>
        {error && <p className="text-[12px] text-[#ff0004] mt-2">{error.message}</p>}
      </section>

      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-3">Linked Centers</h3>
        {loading && <p className="text-[13px] text-[color:var(--ink-soft)]">Loading…</p>}
        {!loading && links.length === 0 && (
          <p className="text-[13px] text-[color:var(--ink-soft)]">No radiology centers linked yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {links.map(link => (
            <div key={link.id} className="flex items-center justify-between p-3 border border-[color:var(--line)] rounded-[8px] bg-[color:var(--surface)]">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[color:var(--ink)]">{link.radiologyCenterName}</span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)]">
                  Requested by {link.requestedBy} · {link.requestedAt}
                  {link.respondedAt ? ` · Responded ${link.respondedAt}` : ""}
                  {link.revokedAt ? ` · Revoked ${link.revokedAt}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={link.status} />
                {ACTIVE_LINK_STATUSES.includes(link.status) && (
                  <button onClick={() => revoke(link.id)} disabled={saving}
                    className="text-[12px] font-normal text-[#ff0004] border border-[#ffd0d1] px-3 py-[6px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-50">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Lab Links Tab ──────────────────────────────────────────────────────────

function LabLinksView() {
  const { items: links, reload, loading } = useList<LabLinkDTO>("/lab-links");
  const { run, loading: saving, error, reset } = useMutation();
  const [code, setCode] = useState("");

  async function requestLink() {
    if (!code.trim()) return;
    await run(() => api.post("/lab-links", { labCenterCode: code.trim() }));
    setCode("");
    reload();
  }

  async function revoke(id: number) {
    await run(() => api.post(`/lab-links/${id}/revoke`, {}));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-5 overflow-y-auto" style={{ height: 580 }}>
      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-2">Link a Lab Center</h3>
        <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-3">
          Enter the lab&apos;s code (shared with you by the lab) to send a link request.
          Once their admin accepts, orders can be routed there and their reports flow back here.
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            value={code}
            onChange={e => { setCode(e.target.value); reset(); }}
            onKeyDown={e => e.key === "Enter" && requestLink()}
            placeholder="e.g. LABC-0001"
            className="flex-1 h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
          />
          <button onClick={requestLink} disabled={saving || !code.trim()}
            className="flex items-center gap-1 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-[8px] hover:bg-[color:var(--brand-hover)] transition-colors whitespace-nowrap disabled:opacity-50">
            <Link2 size={14} /> Request Link
          </button>
        </div>
        {error && <p className="text-[12px] text-[#ff0004] mt-2">{error.message}</p>}
      </section>

      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-3">Linked Labs</h3>
        {loading && <p className="text-[13px] text-[color:var(--ink-soft)]">Loading…</p>}
        {!loading && links.length === 0 && (
          <p className="text-[13px] text-[color:var(--ink-soft)]">No lab centers linked yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {links.map(link => (
            <div key={link.id} className="flex items-center justify-between p-3 border border-[color:var(--line)] rounded-[8px] bg-[color:var(--surface)]">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[color:var(--ink)]">{link.labCenterName}</span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)]">
                  Requested by {link.requestedBy} · {link.requestedAt}
                  {link.respondedAt ? ` · Responded ${link.respondedAt}` : ""}
                  {link.revokedAt ? ` · Revoked ${link.revokedAt}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={link.status} />
                {ACTIVE_LINK_STATUSES.includes(link.status) && (
                  <button onClick={() => revoke(link.id)} disabled={saving}
                    className="text-[12px] font-normal text-[#ff0004] border border-[#ffd0d1] px-3 py-[6px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-50">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: "settings",        label: "Settings" },
  { id: "master",          label: "Master Data" },
  { id: "users",           label: "Users" },
  { id: "radiology-links", label: "Radiology Links" },
  { id: "lab-links",       label: "Lab Links" },
];

export default function AdminPage() {
  const { user } = useAuth();
  // IT Admin manages user access only — hospital settings and master data
  // stay Super Admin territory.
  const isItAdmin = user?.role === "IT Admin";
  const TABS = isItAdmin ? ALL_TABS.filter(t => t.id === "users") : ALL_TABS;
  const [tab, setTab] = useState("settings");
  // `user` loads asynchronously, so `isItAdmin` isn't known on the very first
  // render — derive the effective tab rather than storing a guess in state.
  const activeTab = isItAdmin ? "users" : tab;

  return (
    <>
      <div className={`${tw.gutterX} pt-[16px] mb-5`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[color:var(--subtle-2)] rounded-[10px] flex items-center justify-center shrink-0">
            <Settings2 size={18} className="text-[color:var(--ink-soft)]" />
          </div>
          <div>
            <h1 className="text-[26px] font-medium text-[color:var(--ink)] leading-8">Admin Panel</h1>
            <p className="text-[14px] font-light text-[color:var(--ink-soft)]">
              {isItAdmin ? "Manage user access and roles." : "Manage hospital settings, master data, and user access."}
            </p>
          </div>
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />
          {activeTab === "settings"        && <SettingsView />}
          {activeTab === "master"          && <MasterDataView />}
          {activeTab === "users"           && <UsersView />}
          {activeTab === "radiology-links" && <RadiologyLinksView />}
          {activeTab === "lab-links"       && <LabLinksView />}
        </div>
      </div>
    </>
  );
}
