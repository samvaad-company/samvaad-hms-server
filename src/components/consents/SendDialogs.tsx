"use client";

/**
 * "Send to sign on phone": who will sign, how the link reaches them (QR code, email, WhatsApp / SMS, or this device),
 * and how long it works. Then "Ready to sign": the QR code and link, to show or send. Email opens the staff member's
 * mail app with the message written in the form's language; WhatsApp / SMS uses the device's own share menu — this
 * server sends nothing itself.
 */
import { useEffect, useState } from "react";
import { Copy, Check, Mail, Share2, Smartphone, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput } from "@/components/shared/FormRow";
import type { ConsentDelivery, ConsentDTO } from "@/types/api";
import { attempt, ErrorNote, fieldLabel, outlineBtn, primaryBtn, cancelBtn } from "@/components/mrd/shared";

export const fullUrl = (path: string) => `${window.location.origin}${path}`;

/** The message that goes with the link, in the language of the form. */
export function shareMessage(c: Pick<ConsentDTO, "formTitle" | "language" | "patientName">, url: string): string {
  if (c.language === "Hindi") return `कृपया "${c.formTitle}" पढ़ें और हस्ताक्षर करें (${c.patientName}): ${url}`;
  if (c.language === "Gujarati") return `કૃપા કરીને "${c.formTitle}" વાંચો અને સહી કરો (${c.patientName}): ${url}`;
  return `Please read and sign "${c.formTitle}" (${c.patientName}): ${url}`;
}

const METHODS: { id: ConsentDelivery; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: "qr", label: "QR code", hint: "The patient scans it with their phone camera", icon: QrCode },
  { id: "email", label: "Email", hint: "A link to their email address", icon: Mail },
  { id: "whatsapp", label: "WhatsApp / SMS", hint: "Send from this device's share menu", icon: Share2 },
  { id: "device", label: "Sign on this device", hint: "Hand this tablet or phone to them", icon: Smartphone },
];

export function SendDialog({ consent, onClose, onCreated }: { consent: ConsentDTO; onClose: () => void; onCreated: (c: ConsentDTO) => void }) {
  const { run, loading, error, reset } = useMutation();
  const [signer, setSigner] = useState(consent.patientName);
  const [delivery, setDelivery] = useState<ConsentDelivery>("qr");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(3);
  const close = () => { reset(); onClose(); };

  async function create() {
    // The tablet opens the form in a new tab: that tab has to be opened inside the click, before the request finishes.
    const tab = delivery === "device" ? window.open("", "_blank") : null;
    let made: ConsentDTO | null = null;
    const ok = await attempt(run(async () => { made = await api.post<ConsentDTO>(`/consents/${consent.id}/link`, { signerName: signer.trim(), delivery, validDays: days, email: email.trim() }); }));
    if (!ok || !made) { tab?.close(); return; }
    const c: ConsentDTO = made;
    const url = fullUrl(c.link ?? "");
    if (delivery === "device") { if (tab) tab.location.href = url; else window.open(url, "_blank"); }
    if (delivery === "email") window.open(`mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(c.formTitle)}&body=${encodeURIComponent(shareMessage(c, url))}`, "_self");
    onCreated(c);
  }

  return (
    <Modal open onClose={close} width={600} title="Send to sign on phone"
      subtitle={`${consent.formTitle} for ${consent.patientName}. They read it and sign with their finger - you are notified the moment it is signed.`}
      footer={
        <>
          <button onClick={close} className={cancelBtn}>Cancel</button>
          <button onClick={create} disabled={loading || signer.trim().length < 2 || (delivery === "email" && !/^\S+@\S+\.\S+$/.test(email.trim()))} className={primaryBtn}>
            {loading ? "Preparing…" : delivery === "email" ? "Email the link" : delivery === "device" ? "Open to sign" : "Create link"}
          </button>
        </>
      }>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>Who will sign?</span>
          <FormInput value={signer} onChange={setSigner} />
          <p className="text-[12px] text-[color:var(--ink-soft)]">The patient, or the relative signing for them.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setDelivery(m.id)} aria-pressed={delivery === m.id}
                className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 text-left cursor-pointer transition-colors ${delivery === m.id ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]" : "border-[color:var(--line)] bg-[color:var(--faint)] hover:bg-[color:var(--subtle)]"}`}>
                <Icon size={18} className="mt-[2px] shrink-0 text-[color:var(--ink-soft)]" />
                <span><span className="block text-[14px] font-medium text-[color:var(--ink)]">{m.label}</span><span className="block text-[12px] leading-[16px] text-[color:var(--ink-soft)]">{m.hint}</span></span>
              </button>
            );
          })}
        </div>
        {delivery === "email" && (
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Email address</span><FormInput type="email" value={email} onChange={setEmail} placeholder="name@example.com" /></div>
        )}
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>The link works for</span>
          <div className="flex gap-2">
            {[1, 3, 7].map((d) => (
              <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
                className={`h-[30px] rounded-full border px-4 text-[13px] cursor-pointer transition-colors ${days === d ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>{d} {d === 1 ? "day" : "days"}</button>
            ))}
          </div>
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function ReadyDialog({ consent, onClose }: { consent: ConsentDTO; onClose: () => void }) {
  const url = consent.link ? fullUrl(consent.link) : "";
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    let live = true;
    if (url) QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then((d) => { if (live) setQr(d); }).catch(() => undefined);
    return () => { live = false; };
  }, [url]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setShareError("Couldn't copy — select the link and copy it."); }
  }
  async function share() {
    setShareError("");
    const text = shareMessage(consent, url);
    try {
      if (navigator.share) await navigator.share({ title: consent.formTitle, text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShareError("Couldn't open the share menu.");
    }
  }

  return (
    <Modal open onClose={onClose} width={440} title="Ready to sign"
      subtitle={`Ask ${consent.signerName || consent.patientName} to scan the code, or send the link. It works until it is signed or cancelled.`}
      footer={<button onClick={onClose} className={primaryBtn}>Done</button>}>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-[10px] border border-[color:var(--line)] bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code to sign ${consent.formTitle}`} width={180} height={180} />
          ) : <div className="h-[180px] w-[180px]" />}
        </div>
        <div className="flex w-full items-center gap-2">
          <input readOnly value={url} aria-label="Signing link" onFocus={(e) => e.currentTarget.select()} className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 font-mono text-[13px] text-[color:var(--ink)]" />
          <button onClick={copy} className={outlineBtn + " !h-[40px]"}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={share} className={outlineBtn}><Share2 size={14} /> WhatsApp / SMS…</button>
          <button onClick={() => window.open(url, "_blank")} className={outlineBtn}><Smartphone size={14} /> Sign on this device</button>
        </div>
        <ErrorNote message={shareError} />
      </div>
    </Modal>
  );
}
