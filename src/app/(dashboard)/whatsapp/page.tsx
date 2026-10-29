"use client";

/**
 * Setup → WhatsApp: connect the hospital's own WhatsApp Business number (Meta Embedded Signup, or typed in), set how the assistant and
 * the signing-link messages behave, and see what was sent and received. Admins only; the access token is never shown.
 */
import { useState, type ReactNode } from "react";
import { CheckCircle2, Copy, KeyRound, LogIn, MessageCircle, RefreshCw, Send, Unplug } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { tw } from "@/lib/design-system";
import type { WhatsappMessageDTO, WhatsappSendResult, WhatsappStatusDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DialogButtons, ErrorNote, outlineBtn, Pill, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { Labelled, ToggleRow } from "@/components/setup/ui";
import { embeddedSignup } from "@/components/whatsapp/facebook";
import { formatDate } from "@/lib/dates";

const Card = ({ title, note, children, action }: { title: string; note?: string; children: ReactNode; action?: ReactNode }) => (
  <section className={`${tw.surface.card} ${tw.radius.card}`}>
    <header className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
      <div className="min-w-0"><h2 className="text-[15px] font-medium text-[color:var(--ink)]">{title}</h2>{note && <p className="text-[12px] text-[color:var(--ink-soft)]">{note}</p>}</div>
      <div className="ml-auto">{action}</div>
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Fact = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="min-w-0"><p className="text-[12px] text-[color:var(--ink-soft)]">{label}</p><p className={`truncate text-[14px] text-[color:var(--ink)] ${mono ? "font-mono text-[13px]" : ""}`} title={value}>{value || "—"}</p></div>
);

const STATUS_TONE: Record<WhatsappMessageDTO["status"], string> = { received: "grey", sent: "blue", delivered: "green", read: "green", failed: "red" };

export default function WhatsappPage() {
  const { can, loading: authLoading } = useAuth();
  const { item: s, reload } = useItem<WhatsappStatusDTO>("/whatsapp");
  const { items: messages, reload: reloadMessages } = useList<WhatsappMessageDTO>("/whatsapp/messages");
  const connect = useMutation();
  const save = useMutation();
  const test = useMutation();
  const [manual, setManual] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<WhatsappSendResult | null>(null);
  const [copied, setCopied] = useState("");

  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">WhatsApp is managed by hospital administrators.</p></div>;
  const canWrite = can("admin", "write");
  const webhookUrl = typeof window === "undefined" ? "" : `${window.location.origin}${s?.webhook.path ?? "/api/whatsapp/webhook"}`;
  const copy = async (what: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked */ } };

  async function withFacebook() {
    if (!s) return;
    setSignupError(""); setSigningUp(true);
    try {
      const r = await embeddedSignup({ appId: s.embedded.appId, configId: s.embedded.configId, version: s.embedded.apiVersion });
      if (await attempt(connect.run(() => api.post("/whatsapp/callback", r)))) { reload(); reloadMessages(); }
    } catch (e) { setSignupError(e instanceof Error ? e.message : "The sign-up didn't finish."); }
    finally { setSigningUp(false); }
  }
  async function patch(body: Record<string, unknown>) { if (await attempt(save.run(() => api.patch("/whatsapp", body)))) reload(); }
  async function disconnect() { if (await attempt(connect.run(() => api.del("/whatsapp")))) { setConfirmOff(false); reload(); } }
  async function sendTest() {
    setTestResult(null);
    let result: WhatsappSendResult | null = null;
    if (await attempt(test.run(async () => { result = await api.post<WhatsappSendResult>("/whatsapp/test", { to: testTo.trim() }); }))) { setTestResult(result); reloadMessages(); }
  }

  return (
    <div className={`${tw.gutterX} flex flex-col gap-5 pb-[30px] pt-[16px]`}>
      <div>
        <h1 className="text-[24px] font-medium leading-[28px] text-[color:var(--ink)]">WhatsApp</h1>
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">Connect the hospital&apos;s WhatsApp Business number to send signing links and answer patients&apos; messages.</p>
      </div>

      <Card title="Connection" note="One number per hospital" action={s?.connected ? <Pill tone="green">Connected</Pill> : <Pill tone="grey">Not connected</Pill>}>
        {!s ? <p className="text-[13px] text-[color:var(--ink-soft)]">Loading…</p> : s.connected ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Fact label="Number" value={s.displayPhone} />
              <Fact label="Business name" value={s.verifiedName} />
              <Fact label="WhatsApp account ID" value={s.wabaId} mono />
              <Fact label="Phone number ID" value={s.phoneNumberId} mono />
              <Fact label="Connected through" value={s.via === "embedded" ? "Facebook sign-in" : "Details typed in"} />
              <Fact label="API version" value={s.apiVersion} mono />
              <Fact label="Last updated" value={s.updatedAt ? formatDate(s.updatedAt.slice(0, 10)) : ""} />
              <div><p className="text-[12px] text-[color:var(--ink-soft)]">Receiving messages</p>{s.subscribed ? <p className="flex items-center gap-1 text-[14px] text-[#00794a]"><CheckCircle2 size={14} /> Subscribed</p> : <p className="text-[14px] text-[#a65f00]">Not subscribed yet</p>}</div>
            </div>
            {!s.subscribed && <p role="alert" className="rounded-[8px] border border-[#f6d9a4] bg-[#fffaf0] px-3 py-2 text-[13px] text-[#7a5a00]">Meta didn&apos;t confirm the subscription, so patients&apos; messages may not arrive. Save the details again, or subscribe this app to the account in Meta&apos;s WhatsApp settings.</p>}
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                {s.embedded.available && <button onClick={withFacebook} disabled={signingUp || connect.loading} className={outlineBtn}><LogIn size={14} /> Reconnect with Facebook</button>}
                <button onClick={() => setManual(true)} className={outlineBtn}><KeyRound size={14} /> Edit details</button>
                <button onClick={() => setConfirmOff(true)} className={outlineBtn + " !text-[#c8001a]"}><Unplug size={14} /> Disconnect</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-[color:var(--ink)]">No WhatsApp number is connected. Connect one to send a patient their signing link on WhatsApp and to let the assistant answer their messages.</p>
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={withFacebook} disabled={!s.embedded.available || signingUp || connect.loading} className={primaryBtn}><LogIn size={15} /> {signingUp ? "Waiting for Facebook…" : "Connect with Facebook"}</button>
                <button onClick={() => setManual(true)} className={outlineBtn + " !h-[36px]"}><KeyRound size={14} /> Enter details manually</button>
              </div>
            )}
            {!s.embedded.available && <p className="text-[12px] text-[color:var(--ink-soft)]">Facebook sign-in isn&apos;t set up on this server (it needs FACEBOOK_APP_ID, FACEBOOK_APP_SECRET and FACEBOOK_WHATSAPP_CONFIGURATION_ID). You can still enter the details by hand.</p>}
          </div>
        )}
        <div className="mt-3"><ErrorNote message={signupError || connect.error?.message} /></div>
      </Card>

      {s?.connected && (
        <>
          <Card title="Assistant and signing links" note="How this number is used">
            <div className="flex flex-col gap-4">
              <ToggleRow label="Answer patients' messages" hint="The assistant books appointments, lists appointments and prescriptions, and answers simple questions." checked={s.botEnabled} onChange={(v) => canWrite && patch({ botEnabled: v })} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Labelled label="Country code" hint="For numbers saved without one"><FormInput value={s.defaultCountry} onChange={() => undefined} disabled /></Labelled>
                <TemplateFields s={s} disabled={!canWrite} busy={save.loading} onSave={patch} />
              </div>
              <ErrorNote message={save.error?.message} />
            </div>
          </Card>

          <Card title="Webhook" note="Set this once in Meta → WhatsApp → Configuration so patients' messages reach the assistant">
            <div className="flex flex-col gap-3">
              <Labelled label="Callback URL">
                <div className="flex gap-2"><input readOnly value={webhookUrl} aria-label="Webhook callback URL" onFocus={(e) => e.currentTarget.select()} className="h-[36px] min-w-0 flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 font-mono text-[13px]" /><button onClick={() => copy("url", webhookUrl)} className={outlineBtn + " !h-[36px]"}><Copy size={14} /> {copied === "url" ? "Copied" : "Copy"}</button></div>
              </Labelled>
              <p className="text-[13px] text-[color:var(--ink)]">Verify token: the value of <code className="rounded bg-[color:var(--subtle)] px-1">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> on the server — {s.webhook.verifyTokenConfigured ? <span className="text-[#00794a]">set</span> : <span className="text-[#c8001a]">not set</span>}. Subscribe to the <b>messages</b> field. Messages are {s.webhook.signatureCheck ? <span className="text-[#00794a]">checked against the app secret</span> : <span className="text-[#a65f00]">not signature-checked (FACEBOOK_APP_SECRET isn&apos;t set)</span>}.</p>
              <p className="text-[12px] text-[color:var(--ink-soft)]">The address must be public and HTTPS — on a laptop use a tunnel such as ngrok or Cloudflare Tunnel.</p>
            </div>
          </Card>

          <Card title="Send a test message" note="Checks the connection end to end">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[260px]"><Labelled label="WhatsApp number"><FormInput value={testTo} onChange={setTestTo} placeholder="98765 43210" /></Labelled></div>
              <button onClick={sendTest} disabled={test.loading || testTo.trim().length < 8 || !canWrite} className={primaryBtn}><Send size={14} /> {test.loading ? "Sending…" : "Send test"}</button>
            </div>
            {testResult && (testResult.state === "sent"
              ? <p className="mt-3 flex items-center gap-1 text-[13px] text-[#00794a]"><CheckCircle2 size={14} /> Sent to {testResult.to}. If it doesn&apos;t arrive, the person must have messaged this number in the last 24 hours.</p>
              : <p role="alert" className="mt-3 text-[13px] text-[#c8001a]">{testResult.detail ?? "It couldn't be sent."}</p>)}
            <div className="mt-2"><ErrorNote message={test.error?.message} /></div>
          </Card>

          <Card title="Recent activity" note="Messages through this number" action={<button onClick={reloadMessages} className={outlineBtn}><RefreshCw size={13} /> Refresh</button>}>
            {messages.length === 0 ? <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing yet.</p> : (
              <ul className="divide-y divide-[color:var(--line)]">
                {messages.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-2 text-[13px]">
                    <MessageCircle size={15} className={`mt-[2px] shrink-0 ${m.direction === "in" ? "text-[#3b63c4]" : "text-[#00794a]"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[color:var(--ink-soft)]">{m.direction === "in" ? "From" : "To"} {m.phone} · {m.kind === "bot" ? "assistant" : m.kind === "consent" ? "signing link" : m.kind} · {new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                      <p className="whitespace-pre-line break-words text-[color:var(--ink)]">{m.body.length > 220 ? `${m.body.slice(0, 220)}…` : m.body}</p>
                      {m.error && <p className="text-[12px] text-[#c8001a]">{m.error}</p>}
                    </div>
                    <Pill tone={STATUS_TONE[m.status]}>{m.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {manual && s && <ManualDialog status={s} onClose={() => { setManual(false); reload(); }} />}
      <ConfirmDialog open={confirmOff} title="Disconnect WhatsApp?" message="Signing links can no longer be sent on WhatsApp and the assistant stops answering. You can connect again at any time." confirmLabel="Disconnect" loading={connect.loading} onConfirm={disconnect} onCancel={() => setConfirmOff(false)} />
    </div>
  );
}

function TemplateFields({ s, disabled, busy, onSave }: { s: WhatsappStatusDTO; disabled: boolean; busy: boolean; onSave: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(s.consentTemplate.name);
  const [lang, setLang] = useState(s.consentTemplate.language);
  const [format, setFormat] = useState<string>(s.consentTemplate.format);
  const changed = name !== s.consentTemplate.name || lang !== s.consentTemplate.language || format !== s.consentTemplate.format;
  return (
    <>
      <Labelled label="Signing-link template" hint="Approved name in Meta; leave blank to send plain text"><FormInput value={name} onChange={setName} placeholder="consent_sign_link" disabled={disabled} /></Labelled>
      <Labelled label="Template language"><FormInput value={lang} onChange={setLang} placeholder="en" disabled={disabled} /></Labelled>
      <Labelled label="Variables" hint="How the template numbers them"><FormSelect value={format} onChange={setFormat} options={[{ value: "positional", label: "Numbered {{1}} {{2}}" }, { value: "named", label: "Named {{patient_name}}" }]} /></Labelled>
      <div className="md:col-span-4 flex flex-wrap items-center gap-3">
        <button onClick={() => onSave({ templateName: name, templateLanguage: lang, templateFormat: format })} disabled={disabled || busy || !changed} className={primaryBtn}>{busy ? "Saving…" : "Save template"}</button>
        <p className="text-[12px] text-[color:var(--ink-soft)]">WhatsApp lets a hospital start a conversation only with an approved template. Its variables are, in order: patient name, form title, signing link, hospital name (named: patient_name, form_title, link, hospital_name).</p>
      </div>
    </>
  );
}

function ManualDialog({ status, onClose }: { status: WhatsappStatusDTO; onClose: () => void }) {
  const [wabaId, setWabaId] = useState(status.wabaId);
  const [phoneNumberId, setPhoneNumberId] = useState(status.phoneNumberId);
  const [accessToken, setAccessToken] = useState("");
  const [apiVersion, setApiVersion] = useState(status.apiVersion);
  const { run, loading, error } = useMutation();
  async function submit() { if (await attempt(run(() => api.put("/whatsapp", { wabaId: wabaId.trim(), phoneNumberId: phoneNumberId.trim(), accessToken: accessToken.trim(), apiVersion: apiVersion.trim() })))) onClose(); }
  return (
    <Modal open onClose={onClose} width={520} title={status.connected ? "Edit WhatsApp details" : "Connect WhatsApp by hand"}
      subtitle="From Meta → WhatsApp → API Setup. The details are checked with Meta before they are saved."
      footer={<DialogButtons onCancel={onClose} onConfirm={submit} label="Check and save" busyLabel="Checking…" loading={loading} disabled={!wabaId.trim() || !phoneNumberId.trim() || (!status.connected && accessToken.trim().length < 20)} />}>
      <div className="flex flex-col gap-4">
        <Labelled label="WhatsApp Business Account ID"><FormInput value={wabaId} onChange={setWabaId} placeholder="2055550002222" /></Labelled>
        <Labelled label="Phone number ID"><FormInput value={phoneNumberId} onChange={setPhoneNumberId} placeholder="1055550001111" /></Labelled>
        <Labelled label="Access token" hint={status.connected ? "Leave blank to keep the token already saved. It is stored encrypted and never shown." : "A permanent token from a System User, with whatsapp_business_messaging and whatsapp_business_management."}><FormInput type="password" value={accessToken} onChange={setAccessToken} placeholder={status.connected ? "•••••••• (saved)" : "EAAB…"} /></Labelled>
        <Labelled label="API version"><FormInput value={apiVersion} onChange={setApiVersion} placeholder="v21.0" /></Labelled>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
