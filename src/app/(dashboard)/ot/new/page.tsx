import { redirect } from "next/navigation";

/** The full-page scheduling form was replaced by the Book dialog on the OT screen; old links land there. */
export default function NewOTPage() {
  redirect("/ot?book=1");
}
