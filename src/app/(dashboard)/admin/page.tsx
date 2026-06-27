"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { hospitalSettings, departments, adminUsers } from "@/data/admin";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Trash2, Edit2, Settings2, Save } from "lucide-react";

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsView() {
  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 580 }}>
      {/* Hospital info */}
      <section>
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Hospital Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Hospital Name *",      val: hospitalSettings.name,      ph: "Name" },
            { label: "GST Number",           val: hospitalSettings.gstNumber,  ph: "GSTIN" },
            { label: "Registration Number",  val: hospitalSettings.regNumber,  ph: "MCI / State Reg. No." },
            { label: "Phone",                val: hospitalSettings.phone,      ph: "+91 XXXXX XXXXX" },
            { label: "Email",                val: hospitalSettings.email,      ph: "hospital@email.com" },
            { label: "Website",              val: hospitalSettings.website,    ph: "https://" },
          ].map(f => (
            <FormRow key={f.label} label={f.label}>
              <input defaultValue={f.val} placeholder={f.ph}
                className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] text-[14px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
            </FormRow>
          ))}
          <div className="col-span-2">
            <FormRow label="Address">
              <input defaultValue={hospitalSettings.address} placeholder="Full address"
                className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] text-[14px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
            </FormRow>
          </div>
        </div>
      </section>

      {/* Working hours */}
      <section className="border-t border-[#f0f0f0] pt-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Working Hours</h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}>
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider pt-2">Day</span>
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider pt-2">Morning Start</span>
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider pt-2">Morning End</span>
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider pt-2">Status</span>
          {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day => (
            <>
              <span key={day+"-l"} className="text-[13px] font-normal text-[#11111c] flex items-center">{day}</span>
              <input key={day+"-ms"} defaultValue="9:00 AM"
                className="h-[42px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
              <input key={day+"-me"} defaultValue={day === "Sunday" ? "—" : "8:00 PM"}
                className="h-[42px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
              <select key={day+"-st"} defaultValue={day === "Sunday" ? "closed" : "open"}
                className="h-[42px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="half">Half Day</option>
              </select>
            </>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-5 py-[9px] rounded-full hover:bg-[#007f82] transition-colors">
          <Save size={14} /> Save Settings
        </button>
      </div>
    </div>
  );
}

// ─── Master Data Tab ──────────────────────────────────────────────────────────

const MASTER_SECTIONS = [
  { key: "departments", label: "Departments", items: departments.map(d => d.name) },
  { key: "testTypes",   label: "Lab Test Types", items: ["CBC","Lipid Profile","LFT","KFT","Thyroid Panel","HbA1c","Urine Routine","X-Ray","ECG","Ultrasound"] },
  { key: "services",    label: "Services / Procedures", items: ["Consultation","OPD Visit","ECG","Physiotherapy","Minor Surgery","IV Therapy","Dressing"] },
  { key: "wards",       label: "Wards & Rooms", items: ["General Ward","ICU","Cardiology","Surgery Ward","Maternity"] },
  { key: "insurers",    label: "Insurance Companies", items: ["Star Health","New India Assurance","HDFC Ergo","Bajaj Allianz","ICICI Lombard","United India"] },
];

function MasterDataView() {
  const [activeSection, setActiveSection] = useState("departments");
  const [items, setItems] = useState<Record<string, string[]>>(
    Object.fromEntries(MASTER_SECTIONS.map(s => [s.key, s.items]))
  );
  const [newItem, setNewItem] = useState("");
  const section = MASTER_SECTIONS.find(s => s.key === activeSection)!;
  const currentItems = items[activeSection] ?? [];

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems(prev => ({ ...prev, [activeSection]: [...(prev[activeSection] ?? []), newItem.trim()] }));
    setNewItem("");
  };
  const removeItem = (item: string) =>
    setItems(prev => ({ ...prev, [activeSection]: prev[activeSection].filter(i => i !== item) }));

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

function UsersView() {
  const [showForm, setShowForm] = useState(false);

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
            <FormRow label="Full Name *"><FormInput placeholder="Name" /></FormRow>
            <FormRow label="Email *"><FormInput placeholder="email@hospital.com" type="email" /></FormRow>
            <FormRow label="Role *">
              <FormSelect placeholder="Select role" options={["Administrator","Doctor","Nurse","Receptionist","Accountant","Lab Technician","Pharmacist"].map(r => ({ value: r.toLowerCase(), label: r }))} />
            </FormRow>
            <FormRow label="Department">
              <FormSelect placeholder="Select dept" options={departments.map(d => ({ value: String(d.id), label: d.name }))} />
            </FormRow>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="text-[12px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">Create User</button>
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
