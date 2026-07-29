"use client";

import { useEffect, useState } from "react";
import { tw } from "@/lib/design-system";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import type { DepartmentDTO, AdminUserDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Trash2, Edit2, Settings2, Save, Loader2 } from "lucide-react";

interface HospitalSettings {
  name: string; address: string; city: string; state: string; pincode: string;
  phone: string; mobile: string; email: string; website: string;
  gstNumber: string; panNumber: string; regNumber: string;
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsView() {
  const { item: settings } = useItem<HospitalSettings>("/admin/settings");
  const { run, loading } = useMutation();
  const [form, setForm] = useState<HospitalSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (k: keyof HospitalSettings, v: string) =>
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));

  async function save() {
    if (!form) return;
    setSaved(false);
    await run(() => api.put("/admin/settings", form));
    setSaved(true);
  }

  if (!form) {
    return <div className="p-8 text-[14px] text-[#57575f]">Loading settings…</div>;
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
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Hospital Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <FormRow key={f.key} label={f.label}>
              <FormInput value={form[f.key]} placeholder={f.ph} onChange={v => set(f.key, v)} />
            </FormRow>
          ))}
          <div className="col-span-2">
            <FormRow label="Address">
              <FormInput value={form.address} placeholder="Full address" onChange={v => set("address", v)} />
            </FormRow>
          </div>
        </div>
      </section>

      <div className="flex justify-end items-center gap-3">
        {saved && <span className="text-[13px] text-[#00955c]">Saved ✓</span>}
        <button onClick={save} disabled={loading}
          className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-5 py-[9px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-60">
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
      <div className="w-52 border-r border-[#dedee1] flex flex-col gap-1 p-3 shrink-0">
        {MASTER_SECTIONS.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`text-left px-4 py-[9px] rounded-[8px] text-[13px] font-normal transition-colors ${activeSection === s.key ? "bg-[#009598] text-white" : "text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c]"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {/* Right: items */}
      <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">
        <h3 className="text-[14px] font-medium text-[#11111c]">{section.label}</h3>
        {/* Add new */}
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder={`Add new ${section.label.toLowerCase().replace(/s$/, "")}...`}
            className="flex-1 h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
          />
          <button onClick={addItem}
            className="flex items-center gap-1 text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-[8px] hover:bg-[#007f82] transition-colors whitespace-nowrap">
            <Plus size={14} /> Add
          </button>
        </div>
        {/* Items */}
        <div className="flex flex-col gap-2">
          {currentItems.map(item => (
            <div key={item} className="flex items-center justify-between p-3 border border-[#dedee1] rounded-[8px] bg-white hover:bg-[#fafafa] transition-colors">
              <span className="text-[13px] font-normal text-[#11111c]">{item}</span>
              <div className="flex items-center gap-2">
                <button className="text-[#57575f] hover:text-[#009598] transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => removeItem(item)} className="text-[#57575f] hover:text-[#ff0004] transition-colors"><Trash2 size={14} /></button>
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
  Accountant:    "bg-[#f0f0f0] text-[#57575f]",
};

const ROLE_OPTIONS = ["Super Admin","Doctor","Head Nurse","Receptionist","Billing Exec","Lab Technician","Pharmacist","IT Admin","Radiology Partner"];

function UsersView() {
  const { items: adminUsers, reload } = useList<AdminUserDTO>("/admin/users");
  const { items: departments } = useList<DepartmentDTO>("/departments");
  const { run, loading, error } = useMutation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "Samvaad@123", role: "", departmentId: "" });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function createUser() {
    await run(() =>
      api.post("/admin/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
      }),
    );
    setForm({ name: "", email: "", password: "Samvaad@123", role: "", departmentId: "" });
    setShowForm(false);
    reload();
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 580 }}>
      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#dedee1]">
        <span className="text-[13px] font-normal text-[#57575f]">{adminUsers.length} users total</span>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-[13px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-[#dedee1] bg-[#f6f6f6]">
          <div className="grid grid-cols-4 gap-3">
            <FormRow label={form.role === "Radiology Partner" ? "Radiology Centre Name *" : "Full Name *"}>
              <FormInput placeholder={form.role === "Radiology Partner" ? "e.g. Scanwell Diagnostics" : "Name"} value={form.name} onChange={v => set("name", v)} />
            </FormRow>
            <FormRow label="Email *"><FormInput placeholder="email@hospital.com" type="email" value={form.email} onChange={v => set("email", v)} /></FormRow>
            <FormRow label="Role *">
              <FormSelect placeholder="Select role" value={form.role} onChange={v => set("role", v)} options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))} />
            </FormRow>
            <FormRow label="Department">
              <FormSelect placeholder="Select dept" value={form.departmentId} onChange={v => set("departmentId", v)} options={departments.map(d => ({ value: String(d.id), label: d.name }))} />
            </FormRow>
          </div>
          {form.role === "Radiology Partner" && (
            <p className="text-[12px] font-light text-[#57575f] mt-2">
              Partner centres get their own login and see only the Radiology worklist — reports they upload
              appear instantly in this hospital&apos;s Radiology panel.
            </p>
          )}
          {error && <p className="text-[12px] text-[#ff0004] mt-2">{error.message}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={createUser} disabled={loading || !form.name || !form.email || !form.role}
              className="text-[12px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Creating…" : "Create User"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[12px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-y-auto flex-1">
        <div className="relative h-10 bg-[#f2f3f3]" style={{ minWidth: 900 }}>
          {[{ l: "Name", x: 20 }, { l: "Role", x: 250 }, { l: "Email", x: 440 }, { l: "Last Login", x: 700 }, { l: "Status", x: 880 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {adminUsers.map(u => (
          <div key={u.id} className="relative flex items-center h-[60px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors" style={{ minWidth: 900 }}>
            <div className="absolute flex flex-col" style={{ left: 20 }}>
              <span className="text-[14px] font-medium text-[#11111c] whitespace-nowrap">{u.name}</span>
              <span className="text-[11px] font-light text-[#57575f]">{u.department}</span>
            </div>
            <span className={`absolute inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${ROLE_CLR[u.role] ?? "bg-[#f0f0f0] text-[#57575f]"}`} style={{ left: 250 }}>{u.role}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f] whitespace-nowrap" style={{ left: 440 }}>{u.email}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f] whitespace-nowrap" style={{ left: 700 }}>{u.lastLogin}</span>
            <div className="absolute" style={{ left: 880 }}><StatusBadge status={u.status} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "settings", label: "Settings" },
  { id: "master",   label: "Master Data" },
  { id: "users",    label: "Users" },
];

export default function AdminPage() {
  const [tab, setTab] = useState("settings");

  return (
    <>
      <div className={`${tw.gutterX} mb-5`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#f0f0f0] rounded-[10px] flex items-center justify-center shrink-0">
            <Settings2 size={18} className="text-[#57575f]" />
          </div>
          <div>
            <h1 className="text-[26px] font-medium text-[#11111c] leading-8">Admin Panel</h1>
            <p className="text-[14px] font-light text-[#57575f]">Manage hospital settings, master data, and user access.</p>
          </div>
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "settings" && <SettingsView />}
          {tab === "master"   && <MasterDataView />}
          {tab === "users"    && <UsersView />}
        </div>
      </div>
    </>
  );
}
