"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { DietTypeDTO } from "@/types/api";
import { DIET_MEALS } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow } from "@/components/shared/FormRow";

/** The kinds of diet the hospital serves, with the meals each covers and the standing instruction for the kitchen. */
export function DietsTab({ canWrite }: { canWrite: boolean }) {
  const { item: diets } = useItem<DietTypeDTO[]>("/dietary/diets");
  const [editing, setEditing] = useState<DietTypeDTO | "new" | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [meals, setMeals] = useState<string[]>(["Breakfast", "Lunch", "Dinner"]);
  const { run, loading, error, reset } = useMutation();
  const open = (d: DietTypeDTO | "new") => { setEditing(d); setName(d === "new" ? "" : d.name); setInstructions(d === "new" ? "" : d.instructions); setMeals(d === "new" ? ["Breakfast", "Lunch", "Dinner"] : d.meals); reset(); };
  const close = () => { setEditing(null); reset(); };
  const save = () => run(async () => {
    if (editing === "new") await api.post("/dietary/diets", { name, instructions, meals });
    else if (editing) await api.patch(`/dietary/diets/${editing.id}`, { name, instructions, meals });
    close();
  }).catch(() => undefined);
  if (!diets) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <div className="p-4">
      {canWrite && <div className="mb-3 flex"><button onClick={() => open("new")} className="ml-auto inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-3 py-[6px] text-[13px] font-medium text-white"><Plus size={14} />New diet</button></div>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Diet</th><th className="px-4 py-2 font-medium">Meals</th><th className="px-4 py-2 font-medium">Kitchen instructions</th><th className="px-4 py-2 text-right font-medium">On it now</th><th className="px-4 py-2" /></tr></thead>
          <tbody>
            {diets.map((d) => (
              <tr key={d.id} className={`border-t border-[color:var(--line)] align-top ${d.active ? "" : "opacity-55"}`}>
                <td className="px-4 py-[9px] font-medium">{d.name}{!d.active && <span className="ml-2 rounded-[6px] bg-[color:var(--subtle-2)] px-2 py-[1px] text-[11px] font-normal">Off</span>}</td>
                <td className="px-4 py-[9px] text-[13px]">{d.meals.length ? d.meals.join(", ") : "None"}</td>
                <td className="max-w-[360px] px-4 py-[9px] text-[13px] text-[color:var(--ink-soft)]">{d.instructions}</td>
                <td className="px-4 py-[9px] text-right font-mono">{d.inUse}</td>
                <td className="whitespace-nowrap px-4 py-[9px] text-right text-[13px] font-medium">{canWrite && <><button className="mr-3 cursor-pointer" onClick={() => open(d)}>Edit</button><button className="cursor-pointer text-[color:var(--ink-soft)]" onClick={() => void run(() => api.patch(`/dietary/diets/${d.id}`, { active: !d.active })).catch(() => undefined)}>{d.active ? "Switch off" : "Switch on"}</button></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!editing} onClose={close} title={editing === "new" ? "New diet" : "Edit diet"} width={480}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || name.trim().length < 2} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Save</button></div>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Name" required><FormInput value={name} onChange={setName} /></FormRow>
          <FormRow label="Meals served"><div className="flex flex-wrap gap-x-4 gap-y-2">{DIET_MEALS.map((m) => <label key={m} className="inline-flex cursor-pointer items-center gap-2 text-[14px]"><input type="checkbox" checked={meals.includes(m)} onChange={(e) => setMeals(e.target.checked ? [...meals, m] : meals.filter((x) => x !== m))} />{m}</label>)}</div></FormRow>
          <FormRow label="Instructions for the kitchen"><FormInput value={instructions} onChange={setInstructions} /></FormRow>
          {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
