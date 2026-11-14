"use client";

/** Setup → Masters → Video consultation consent: the wording a patient accepts (by ticking a box) when booking a video consultation. */
import { useAuth } from "@/lib/auth-context";
import { LoadingBlock } from "@/components/shared/Spinner";
import { ConfigCard } from "@/components/setup/ConfigCard";
import { useConfig, type FieldSpec } from "@/components/setup/ui";

const ROWS: FieldSpec[][] = [
  [{ key: "consentTitle", label: "Heading", type: "text" }],
  [{ key: "consentText", label: "Consent wording", type: "textarea", rows: 10, hint: "Shown above the tick box. Put each point on its own line." }],
];
const CHIPS: FieldSpec[] = [{ key: "consentRequired", label: "Patient must accept this to book", type: "toggle" }];

export function TeleconsultConsentView() {
  const { can } = useAuth();
  const { item: cfg, reload } = useConfig("teleconsult");
  if (!cfg) return <LoadingBlock label="Loading consent…" />;
  return (
    <ConfigCard title="Video consultation consent" configKey="teleconsult" rows={ROWS} chips={CHIPS} values={cfg} canEdit={can("admin", "write")} onSaved={reload}
      note="Whoever books a video consultation (the patient on the booking link or in the app, or staff on their behalf) ticks a box to accept this. The wording they accepted is saved with the booking." />
  );
}
