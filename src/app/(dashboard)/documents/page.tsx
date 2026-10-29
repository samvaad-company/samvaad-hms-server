"use client";

/** MRD documents: the retention queue, the retention policies, and the folders. Writing needs the "mrd" permission. */
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell } from "@/components/mrd/shared";
import { FoldersView, PoliciesView, RetentionView } from "@/components/mrd/DocumentViews";

const TABS = [
  { id: "retention", label: "Retention queue" },
  { id: "policies", label: "Policies" },
  { id: "folders", label: "Folders" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function DocumentsPage() {
  const { can } = useAuth();
  const canWrite = can("mrd", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.mrd.documents.tab", IDS, "retention");
  return (
    <MrdShell icon={<FolderOpen size={16} />} title="Documents" tabs={TABS} tab={tab} onTab={setTab}>
      {tab === "retention" && <RetentionView canWrite={canWrite} />}
      {tab === "policies" && <PoliciesView canWrite={canWrite} />}
      {tab === "folders" && <FoldersView canWrite={canWrite} />}
    </MrdShell>
  );
}
