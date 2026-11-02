"use client";

/** Setup → Refer & earn: the hospital's referral code to share, and a note of who has been referred. */
import { useState } from "react";
import { Copy, Gift } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { ErrorNote, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { textarea, useConfig } from "@/components/setup/ui";

export default function ReferPage() {
  const { can, loading: authLoading } = useAuth();
  const { item, reload } = useConfig("referral");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [referred, setReferred] = useState("");
  const [reward, setReward] = useState("");
  const { run, loading, error, reset } = useMutation();
  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Refer &amp; earn is managed by hospital administrators.</p></div>;
  const code = String(item?.code ?? "");
  const list = (item?.referred as string[] | undefined) ?? [];
  const message = `I use Samvaad HMS to run our hospital. Mention referral code ${code} when you ask for a demo.`;

  async function copy() { try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } }
  async function save() {
    reset();
    const lines = referred.split("\n").map((l) => l.trim()).filter(Boolean);
    if (await attempt(run(() => api.put("/setup/config/referral", { referred: lines, rewardNote: reward })))) { setEditing(false); reload(); }
  }
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Gift size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Refer &amp; earn</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">Recommend Samvaad HMS to another hospital</span>
        </div>
        {!item ? <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">Loading…</p> : (
          <div className="grid items-start gap-4 p-5" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <h2 className="mb-1 text-[14px] font-semibold">Your referral code</h2>
              <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Share it with another hospital; they quote it when they sign up.</p>
              <p className="rounded-[8px] bg-[color:var(--subtle)] px-4 py-3 text-center font-mono text-[22px] font-bold tracking-wider">{code}</p>
              <p className="mt-3 rounded-[8px] border border-[color:var(--line)] px-3 py-2 text-[13px]">{message}</p>
              <button onClick={copy} className={outlineBtn + " mt-3 !h-[34px]"}><Copy size={14} /> {copied ? "Copied" : "Copy message"}</button>
            </section>
            <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <div className="mb-2 flex items-center gap-3"><h2 className="text-[14px] font-semibold">Who you have referred</h2>
                {can("admin", "write") && !editing && <button onClick={() => { setReferred(list.join("\n")); setReward(String(item.rewardNote ?? "")); setEditing(true); }} className={outlineBtn + " ml-auto !h-[30px]"}>Edit</button>}
                {editing && <span className="ml-auto flex gap-2"><button onClick={() => setEditing(false)} className={outlineBtn + " !h-[30px]"}>Cancel</button><button onClick={save} disabled={loading} className={primaryBtn + " !h-[30px]"}>{loading ? "Saving…" : "Save"}</button></span>}
              </div>
              {editing ? (
                <div className="flex flex-col gap-3">
                  <label className="text-[14px] font-medium">Hospitals (one per line)<textarea rows={6} value={referred} onChange={(e) => setReferred(e.target.value)} className={textarea + " mt-2"} /></label>
                  <label className="text-[14px] font-medium">Reward note<textarea rows={2} value={reward} onChange={(e) => setReward(e.target.value)} className={textarea + " mt-2"} placeholder="What you have agreed to receive" /></label>
                </div>
              ) : (
                <>
                  {list.length === 0 ? <p className="text-[14px] text-[color:var(--ink-soft)]">No referrals noted yet.</p> : <ul className="list-disc pl-5 text-[14px]">{list.map((l) => <li key={l}>{l}</li>)}</ul>}
                  {String(item.rewardNote ?? "") && <p className="mt-3 text-[13px] text-[color:var(--ink-soft)]">Reward: {String(item.rewardNote)}</p>}
                </>
              )}
              <ErrorNote message={error?.message} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
