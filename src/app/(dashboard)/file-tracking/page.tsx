"use client";

/**
 * MRD file tracking. Files (where each patient file is), Requests (wards asking MRD for a file),
 * Locations (racks, archive rooms, nurse stations…) and a Dashboard. Writing needs the "mrd" permission.
 */
import { FolderSearch } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell } from "@/components/mrd/shared";
import { FilesView } from "@/components/mrd/FilesView";
import { RequestsView } from "@/components/mrd/RequestsView";
import { LocationsView } from "@/components/mrd/LocationsView";
import { FileSummaryView } from "@/components/mrd/FileSummaryView";

const TABS = [
  { id: "files", label: "Files" },
  { id: "requests", label: "Requests" },
  { id: "locations", label: "Locations" },
  { id: "dashboard", label: "Dashboard" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function FileTrackingPage() {
  const { can } = useAuth();
  const canWrite = can("mrd", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.mrd.files.tab", IDS, "files");
  return (
    <MrdShell icon={<FolderSearch size={16} />} title="File tracking" tabs={TABS} tab={tab} onTab={setTab}>
      {tab === "files" && <FilesView canWrite={canWrite} />}
      {tab === "requests" && <RequestsView canWrite={canWrite} />}
      {tab === "locations" && <LocationsView canWrite={canWrite} />}
      {tab === "dashboard" && <FileSummaryView />}
    </MrdShell>
  );
}
