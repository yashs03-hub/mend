import { redirect } from "next/navigation";

/** Legacy operator URL — Ops now lives on the clinician hub. */
export default function ConsolePage() {
  redirect("/clinician#ops");
}
