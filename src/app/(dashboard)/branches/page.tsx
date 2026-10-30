"use client";

/** Setup → Branches: the hospital's locations. One is primary; patient records are shared across all of them. */
import { useState } from "react";
import { Building, MapPin, Phone, Star } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RowMenu } from "@/components/shared/RowMenu";
import { ErrorNote } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { AddButton, FormDialog, Inactive, str, useSetup, type Rec } from "@/components/setup/ui";

export default function BranchesPage() {
  const { can, loading: authLoading } = useAuth();
  const branches = useSetup("branch");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const [removing, setRemoving] = useState<Rec | null>(null);
  const { run, loading, error, reset } = useMutation();
  const canEdit = can("admin", "write");
  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Branches are managed by hospital administrators.</p></div>;

  async function makePrimary(b: Rec) { reset(); await attempt(run(() => api.patch(`/setup/branch/${b.id}`, { isPrimary: true }))); branches.reload(); }
  async function remove() { if (!removing) return; await attempt(run(() => api.del(`/setup/branch/${removing.id}`))); setRemoving(null); branches.reload(); }

  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Building size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Branches</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">{branches.items.length} {branches.items.length === 1 ? "location" : "locations"}</span>
          {canEdit && <span className="ml-auto"><AddButton label="Add branch" onClick={() => setEditing("new")} /></span>}
        </div>
        <div className="p-5">
          <ErrorNote message={error?.message} />
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {branches.items.map((b) => {
              const place = [b.data.city, b.data.state, b.data.pincode].map(str).filter(Boolean).join(", ");
              return (
                <article key={b.id} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-[14px] font-semibold">{b.code}</span>
                    {b.data.isPrimary === true && <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2 py-[1px] text-[11px] text-[color:var(--brand)]"><Star size={10} className="fill-current" /> Primary</span>}
                    {!b.active && <Inactive />}
                    {canEdit && (
                      <span className="ml-auto">
                        <RowMenu actions={[
                          { label: "Edit", onClick: () => setEditing(b) },
                          ...(b.data.isPrimary === true ? [] : [{ label: "Make primary", onClick: () => makePrimary(b) }, { label: "Delete", danger: true, onClick: () => { reset(); setRemoving(b); } }]),
                        ]} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] font-medium">{b.name}</p>
                  {place && <p className="mt-1 flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]"><MapPin size={12} />{place}</p>}
                  {str(b.data.phone) && <p className="mt-1 flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]"><Phone size={12} />{str(b.data.phone)}</p>}
                  <p className="mt-3 flex items-center gap-4 border-t border-[color:var(--line)] pt-3 text-[12px] text-[color:var(--ink-soft)]">
                    <span>Hours <span className="font-mono text-[color:var(--ink)]">{str(b.data.opens)} - {str(b.data.closes)}</span></span>
                    <span>Invoice <span className="font-mono text-[color:var(--ink)]">{str(b.data.invoicePrefix) || b.code}</span></span>
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} width={560} title={editing === "new" ? "Add branch" : "Edit branch"} subtitle="A branch is a location under this organization. Patient records stay shared across every branch."
          endpoint="/setup/branch" id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? "Add branch" : "Save changes"}
          initial={editing === "new" ? { opens: "09:00", closes: "18:00", active: true } : { code: editing.code, name: editing.name, active: editing.active, ...editing.data }}
          rows={[[{ key: "code", label: "Code", placeholder: "MAIN", mono: true, upper: true }, { key: "name", label: "Branch name", placeholder: "Main Hospital", w: 2 }],
            [{ key: "address", label: "Address", type: "textarea", rows: 2, placeholder: "Street / area" }],
            [{ key: "city", label: "City" }, { key: "state", label: "State" }, { key: "pincode", label: "Pincode" }],
            [{ key: "phone", label: "Phone" }, { key: "email", label: "Email" }],
            [{ key: "gstin", label: "GSTIN", placeholder: "15-DIGIT GSTIN", mono: true, upper: true }, { key: "estRegNo", label: "Establishment registration no." }],
            [{ key: "issuingAuthority", label: "Issuing authority", hint: "Clinical Establishments Act or your state's act. Prints on this branch's reports." }, { key: "validUntil", label: "Valid until", type: "date" }],
            [{ key: "invoicePrefix", label: "Invoice prefix", placeholder: "Defaults to code", mono: true, upper: true }, { key: "opens", label: "Opens", type: "time" }, { key: "closes", label: "Closes", type: "time" }],
            [{ key: "isPrimary", label: "Primary branch", type: "toggle", hint: "The org's main location (only one). Its dashboard rolls up untagged activity." }]]}
          onClose={() => { setEditing(null); branches.reload(); }} />
      )}
      <ConfirmDialog open={removing !== null} title={`Delete ${removing?.name ?? "branch"}?`} message={error?.message ?? "The branch is removed. Records stay shared across the others."} confirmLabel="Delete" danger loading={loading} onConfirm={remove} onCancel={() => setRemoving(null)} />
    </div>
  );
}
