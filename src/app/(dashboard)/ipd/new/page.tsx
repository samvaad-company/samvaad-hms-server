import { redirect } from "next/navigation";

/** The full-page admission form was replaced by the admit dialog on the IPD screen; old links land there. */
export default function NewIpdAdmissionPage() {
  redirect("/ipd?admit=1");
}
