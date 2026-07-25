import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mend — post-discharge recovery co-pilot",
  description:
    "Voice-first recovery monitoring for orthopaedic patients after they go home. Educational prototype, synthetic data only.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
