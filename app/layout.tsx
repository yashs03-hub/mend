import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { ConsoleShortcut } from "@/app/components/ConsoleShortcut";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

/** Everything Mend says. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

/** Everything the engine measures. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mend — post-discharge recovery co-pilot",
  description:
    "Voice-first recovery monitoring for orthopaedic patients after they go home. Educational prototype, synthetic data only.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, instrumentSerif.variable, "antialiased")}
    >
      <body className="bg-paper font-sans text-body text-ink">
        {children}
        <ConsoleShortcut />
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
