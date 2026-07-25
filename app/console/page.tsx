import type { Metadata } from "next";
import { DemoConsole } from "./DemoConsole";

export const metadata: Metadata = {
  title: "Demo console — Mend",
  description:
    "Operator surface for scenario selection, vitals entry, Kardia upload, BLE, transcript check-in, and outbound call.",
};

export default function ConsolePage() {
  return (
    <main className="min-h-dvh bg-paper">
      <DemoConsole />
    </main>
  );
}
