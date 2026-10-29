"use client";

/** Consent forms across all patients, and the templates they are made from. Needs the "consents" permission to change anything. */
import { FileSignature } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell } from "@/components/mrd/shared";
import { SignaturesView } from "@/components/mrd/SignaturesView";
import { ConsentTemplates } from "@/components/consents/ConsentTemplates";

const TABS = [
  { id: "consents", label: "Consents" },
  { id: "templates", label: "Templates" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function SignaturesPage() {
  const { can } = useAuth();
  const canWrite = can("consents", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.consents.tab", IDS, "consents");
  return (
    <MrdShell icon={<FileSignature size={16} />} title="Signatures" note="Forms sent to patients' phones to sign" tabs={TABS} tab={tab} onTab={setTab}>
      {tab === "consents" && <SignaturesView canWrite={canWrite} />}
      {tab === "templates" && <ConsentTemplates canWrite={canWrite} />}
    </MrdShell>
  );
}
