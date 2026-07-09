"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Boxes, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { InventoryItemDTO, InventoryIssueDTO, DepartmentDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

const ITEM_CATEGORIES = [
  "Linen", "Consumables", "Medical Equipment", "PPE", "Surgical Supplies",
  "Furniture", "Stationery", "Uniforms",
];

// ─── Items Tab ────────────────────────────────────────────────────────────────

const ITEM_COLUMNS = [
  { label: "Item",      width: "minmax(180px,1.6fr)" },
  { label: "Category",  width: "minmax(130px,1fr)" },
  { label: "Stock",     width: "90px", align: "right" as const },
  { label: "Unit",      width: "80px" },
  { label: "Min Stock", width: "90px", align: "right" as const },
  { label: "Supplier",  width: "minmax(150px,1.3fr)" },
  { label: "Status",    width: "120px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const ITEM_FILTERS = [
  { id: "All", label: "All" }, { id: "In Stock", label: "In Stock" },
  { id: "Low Stock", label: "Low Stock" }, { id: "Out of Stock", label: "Out of Stock" },
];

function ItemRow({ row, actions }: { row: InventoryItemDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate">{row.category}</span>
      <span className={`text-[13px] font-medium text-right ${row.stock === 0 ? "text-[#ff0004]" : row.stock < row.minStock ? "text-[#ff9000]" : "text-[#11111c]"}`}>{row.stock}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.unit}</span>
      <span className="text-[13px] font-normal text-[#57575f] text-right">{row.minStock}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.supplier || "—"}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Issues Tab ───────────────────────────────────────────────────────────────

const ISSUE_COLUMNS = [
  { label: "Item",       width: "minmax(180px,1.6fr)" },
  { label: "Department", width: "minmax(130px,1.1fr)" },
  { label: "Qty",        width: "70px", align: "right" as const },
  { label: "Issued To",  width: "minmax(150px,1.3fr)" },
  { label: "Date",       width: "110px" },
  { label: "Note",       width: "minmax(160px,1.5fr)" },
  { label: "Action",     width: "52px", align: "right" as const },
];

function IssueRow({ row, actions }: { row: InventoryIssueDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.itemName}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.department}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">{row.quantity}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.issuedTo || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
      <span className="text-[13px] font-light text-[#57575f] truncate">{row.note || "—"}</span>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState("items");
  const [itemFilter, setItemFilter] = useState("All");
  const [itemSearch, setItemSearch] = useState("");
  const [issueSearch, setIssueSearch] = useState("");
  const [modal, setModal] = useState<"" | "item" | "issue" | "restock">("");
  const [restockTarget, setRestockTarget] = useState<InventoryItemDTO | null>(null);
  const [restockQty, setRestockQty] = useState("");

  const { items, reload: reloadItems } = useList<InventoryItemDTO>("/inventory/items", { all: true });
  const { items: issues, reload: reloadIssues } = useList<InventoryIssueDTO>("/inventory/issues", { all: true });
  const { items: departments } = useList<DepartmentDTO>("/departments", { all: true });
  const reloadAll = () => { reloadItems(); reloadIssues(); };
  const itemActions = useRowActions("inventory/items", reloadAll);
  const issueActions = useRowActions("inventory/issues", reloadAll);
  const { run, loading, error, reset } = useMutation();

  const [itemForm, setItemForm] = useState({ name: "", category: "", unit: "pcs", stock: "", minStock: "", supplier: "" });
  const [issueForm, setIssueForm] = useState({ itemId: "", department: "", quantity: "", issuedTo: "", note: "" });

  const closeModal = () => { setModal(""); setRestockTarget(null); reset(); };

  async function submitItem() {
    await run(() => api.post("/inventory/items", {
      name: itemForm.name,
      category: itemForm.category,
      unit: itemForm.unit,
      stock: Number(itemForm.stock),
      minStock: itemForm.minStock ? Number(itemForm.minStock) : undefined,
      supplier: itemForm.supplier,
    }));
    setItemForm({ name: "", category: "", unit: "pcs", stock: "", minStock: "", supplier: "" });
    closeModal();
    reloadItems();
  }

  async function submitIssue() {
    await run(() => api.post("/inventory/issues", {
      itemId: Number(issueForm.itemId),
      department: issueForm.department,
      quantity: Number(issueForm.quantity),
      issuedTo: issueForm.issuedTo,
      note: issueForm.note,
    }));
    setIssueForm({ itemId: "", department: "", quantity: "", issuedTo: "", note: "" });
    closeModal();
    reloadAll();
  }

  async function submitRestock() {
    if (!restockTarget) return;
    await run(() => api.post(`/inventory/items/${restockTarget.id}/restock`, { quantity: Number(restockQty) }));
    setRestockQty("");
    closeModal();
    reloadItems();
  }

  const TABS = [
    { id: "items",  label: "Stock Items", count: items.length },
    { id: "issues", label: "Issue Log",   count: issues.length },
  ];

  const lowStock = items.filter(i => i.status !== "In Stock").length;

  const visibleItems = items.filter(i => {
    const matchF = itemFilter === "All" || i.status === itemFilter;
    const q = itemSearch.toLowerCase();
    return matchF && (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q));
  });
  const visibleIssues = issues.filter(i => {
    const q = issueSearch.toLowerCase();
    return !q || i.itemName.toLowerCase().includes(q) || i.department.toLowerCase().includes(q) || i.issuedTo.toLowerCase().includes(q);
  });

  const modalError = error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>;
  const modalFooter = (onSubmit: () => void, label: string, disabled: boolean) => (
    <>
      <button onClick={closeModal} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
      <button onClick={onSubmit} disabled={loading || disabled}
        className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
        {loading ? "Saving…" : label}
      </button>
    </>
  );

  return (
    <>
      {itemActions.dialog}
      {issueActions.dialog}

      <Modal open={modal === "item"} onClose={closeModal} title="Add Stock Item"
        footer={modalFooter(submitItem, "Add Item", !itemForm.name || !itemForm.category || itemForm.stock === "")}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Item Name *"><FormInput placeholder="e.g. Bed Sheets (White)" value={itemForm.name} onChange={v => setItemForm(f => ({ ...f, name: v }))} /></FormRow>
          <FormRow label="Category *"><FormSelect placeholder="Select category" value={itemForm.category} onChange={v => setItemForm(f => ({ ...f, category: v }))} options={ITEM_CATEGORIES.map(c => ({ value: c, label: c }))} /></FormRow>
          <FormRow label="Opening Stock *"><FormInput type="number" placeholder="0" value={itemForm.stock} onChange={v => setItemForm(f => ({ ...f, stock: v }))} /></FormRow>
          <FormRow label="Unit"><FormInput placeholder="pcs / boxes / rolls" value={itemForm.unit} onChange={v => setItemForm(f => ({ ...f, unit: v }))} /></FormRow>
          <FormRow label="Min Stock" hint="Low-stock alert threshold"><FormInput type="number" placeholder="10" value={itemForm.minStock} onChange={v => setItemForm(f => ({ ...f, minStock: v }))} /></FormRow>
          <FormRow label="Supplier"><FormInput placeholder="Supplier name" value={itemForm.supplier} onChange={v => setItemForm(f => ({ ...f, supplier: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "issue"} onClose={closeModal} title="Issue Item"
        footer={modalFooter(submitIssue, "Issue", !issueForm.itemId || !issueForm.department || !issueForm.quantity)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Item *">
            <FormSelect placeholder="Select item" value={issueForm.itemId} onChange={v => setIssueForm(f => ({ ...f, itemId: v }))}
              options={items.filter(i => i.stock > 0).map(i => ({ value: String(i.id), label: `${i.name} (${i.stock} ${i.unit})` }))} />
          </FormRow>
          <FormRow label="Department *">
            <FormSelect placeholder="Select department" value={issueForm.department} onChange={v => setIssueForm(f => ({ ...f, department: v }))}
              options={departments.map(d => ({ value: d.name, label: d.name }))} />
          </FormRow>
          <FormRow label="Quantity *"><FormInput type="number" placeholder="1" value={issueForm.quantity} onChange={v => setIssueForm(f => ({ ...f, quantity: v }))} /></FormRow>
          <FormRow label="Issued To"><FormInput placeholder="Person or desk" value={issueForm.issuedTo} onChange={v => setIssueForm(f => ({ ...f, issuedTo: v }))} /></FormRow>
          <FormRow label="Note"><FormInput placeholder="Optional note" value={issueForm.note} onChange={v => setIssueForm(f => ({ ...f, note: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "restock"} onClose={closeModal} title={`Restock ${restockTarget?.name ?? ""}`}
        footer={modalFooter(submitRestock, "Restock", !restockQty)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Current Stock"><FormInput value={`${restockTarget?.stock ?? 0} ${restockTarget?.unit ?? ""}`} disabled /></FormRow>
          <FormRow label="Add Quantity *"><FormInput type="number" placeholder="0" value={restockQty} onChange={setRestockQty} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <PageHeader
        title="Inventory"
        subtitle="Track hospital supplies and equipment, and issue stock to departments."
        stats={[{ icon: Boxes, value: `${lowStock}`, label: "Items Needing Restock" }]}
        action={{ label: tab === "issues" ? "Issue Item" : "Add Item", icon: Plus, onClick: () => setModal(tab === "issues" ? "issue" : "item") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "items" && (
            <>
              <FilterBar filters={ITEM_FILTERS} searchPlaceholder="Search by item, category, or supplier..."
                activeFilter={itemFilter} onFilterChange={setItemFilter} searchQuery={itemSearch} onSearchChange={setItemSearch}
                action={{ label: "Add Item", icon: Plus, onClick: () => setModal("item") }} />
              <DataTable columns={ITEM_COLUMNS} minWidth={1150}>
                {visibleItems.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No items found.</div>
                ) : visibleItems.map(i => (
                  <ItemRow key={i.id} row={i} actions={[
                    { label: "Restock", onClick: () => { setRestockTarget(i); setModal("restock"); } },
                    { label: "Issue to department", disabled: i.stock === 0, onClick: () => { setIssueForm(f => ({ ...f, itemId: String(i.id) })); setModal("issue"); } },
                    { label: "Delete", danger: true, onClick: () => itemActions.remove(i.id, i.name) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}

          {tab === "issues" && (
            <>
              <FilterBar filters={[{ id: "All", label: "All" }]} searchPlaceholder="Search by item, department, or person..."
                activeFilter="All" onFilterChange={() => {}} searchQuery={issueSearch} onSearchChange={setIssueSearch}
                action={{ label: "Issue Item", icon: Plus, onClick: () => setModal("issue") }} />
              <DataTable columns={ISSUE_COLUMNS} minWidth={1100}>
                {visibleIssues.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No issues logged.</div>
                ) : visibleIssues.map(i => (
                  <IssueRow key={i.id} row={i} actions={[
                    { label: "Delete", danger: true, onClick: () => issueActions.remove(i.id, `issue of ${i.itemName}`) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
        </div>
      </div>
    </>
  );
}
