import type { Metadata } from "next";
import { LandingPage } from "@/app/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Mend — Post-op recovery that doesn’t end at discharge",
  description:
    "Voice-first post-op orthopedic recovery co-pilot. Deterministic clinical engine. One morning check-in for patients, families, and clinicians.",
};

export default function Home() {
  return <LandingPage />;
}
