import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SeverityChip, SeverityPanel } from "@/components/ui/severity-chip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Severity } from "@/lib/clinical/types";
import { SEVERITY, SEVERITY_LEVELS, severityContrast } from "@/lib/ui/severity";
import { cn } from "@/lib/utils";
import { ToastDemo } from "./toast-demo";

export const metadata: Metadata = {
  title: "Design system — Mend",
  description:
    "Type scale, severity tokens and core components for Mend's interface.",
};

function Section({
  index,
  title,
  blurb,
  children,
}: {
  index: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-8 border-t border-line py-14 md:grid-cols-[13rem_1fr] md:gap-16 md:py-20">
      <div className="space-y-3 md:sticky md:top-0 md:self-start">
        <p className="eyebrow numeric">{index}</p>
        <h2 className="font-heading text-heading">{title}</h2>
        <p className="text-label text-ink-secondary">{blurb}</p>
      </div>
      <div className="min-w-0 space-y-12">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </div>
  );
}

function Swatch({
  name,
  value,
  swatchClassName,
}: {
  name: string;
  value: string;
  swatchClassName: string;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("h-20 rounded-lg border border-line", swatchClassName)} />
      <div className="space-y-0.5">
        <p className="text-label font-medium text-ink">{name}</p>
        <p className="numeric text-meta text-ink-tertiary uppercase">{value}</p>
      </div>
    </div>
  );
}

function Specimen({
  children,
  className,
  name,
  size,
  face,
}: {
  children: ReactNode;
  className: string;
  name: string;
  size: string;
  face: "Instrument Serif" | "Inter";
}) {
  return (
    <div className="grid gap-2 border-b border-line pb-7 last:border-b-0 last:pb-0 md:grid-cols-[1fr_10rem] md:items-baseline md:gap-10">
      <p className={cn("min-w-0 text-ink", className)}>{children}</p>
      <p className="numeric text-meta whitespace-nowrap text-ink-tertiary md:text-right">
        <span className="block">
          {name} · {size}
        </span>
        <span className="block">{face}</span>
      </p>
    </div>
  );
}

function Vital({
  label,
  value,
  unit,
  level,
  reading,
  captured,
}: {
  label: string;
  value: string;
  unit: string;
  level: Severity;
  reading: string;
  captured: string;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-line bg-raised p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <p className="numeric text-meta text-ink-tertiary">{captured}</p>
      </div>
      <p className="flex items-baseline gap-1.5" aria-label={reading}>
        <span aria-hidden="true" className="numeric text-vital font-medium text-ink">
          {value}
        </span>
        <span aria-hidden="true" className="text-label text-ink-tertiary">
          {unit}
        </span>
      </p>
      <SeverityChip level={level} size="sm" />
    </div>
  );
}

const RULES = [
  {
    id: "RED-PE-01",
    fired: "Day 3 · 09:12",
    finding: "Breathless with SpO₂ 93% and HR 122",
    level: "red" as Severity,
  },
  {
    id: "AMB-INF-02",
    fired: "Day 3 · 09:12",
    finding: "Temperature 38.4 °C above phase envelope 37.8 °C",
    level: "amber" as Severity,
  },
  {
    id: "GRN-MOB-01",
    fired: "Day 2 · 08:47",
    finding: "Weight-bearing as prescribed, pain controlled at 4/10",
    level: "green" as Severity,
  },
];

export default function StyleguidePage() {
  return (
    <main className="mx-auto w-full max-w-[76rem] px-6 pb-24 md:px-10">
      <header className="grid gap-10 py-16 md:grid-cols-[13rem_1fr] md:gap-16 md:py-24">
        <p className="eyebrow numeric md:pt-3">Mend · Design system</p>
        <div className="max-w-3xl space-y-7">
          <h1 className="font-heading text-title md:text-display">
            <span className="block">Serif for the human voice.</span>
            <span className="block">Sans for the machine.</span>
          </h1>
          <p className="max-w-2xl text-lede text-ink-secondary">
            Mend puts language models at the edges and a deterministic core in the
            middle. The typography says the same thing: an editorial serif carries
            everything Mend <em>says</em>, a tabular sans carries everything the
            engine <em>measures</em>. There is no brand accent colour — the only
            saturated colour in the product is clinical severity, and it never
            appears without an icon and a label.
          </p>
          <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1 text-meta text-ink-tertiary">
            {[
              ["Palette", "2 faces · 3 severities"],
              ["Body", "17px / 1.6"],
              ["Targets", "44 × 44px"],
              ["Contrast", "WCAG AA"],
            ].map(([term, value]) => (
              <div key={term} className="flex items-baseline gap-2">
                <dt className="uppercase tracking-[0.14em]">{term}</dt>
                <dd className="numeric font-medium text-ink-secondary">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <Section
        index="01"
        title="Surface & ink"
        blurb="Warm paper, warm ink. Nothing here is pure white or pure black, and nothing here is saturated."
      >
        <Subsection title="Surfaces">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="Paper" value="#FDFCFA" swatchClassName="bg-paper" />
            <Swatch name="Raised" value="#FFFFFF" swatchClassName="bg-raised" />
            <Swatch name="Wash" value="#F5F2EC" swatchClassName="bg-wash" />
            <Swatch
              name="Wash strong"
              value="#EFEAE1"
              swatchClassName="bg-wash-strong"
            />
            <Swatch name="Line" value="#E7E2DC" swatchClassName="bg-line" />
          </div>
        </Subsection>

        <Subsection title="Ink">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="Ink" value="#1C1917" swatchClassName="bg-ink" />
            <Swatch
              name="Ink secondary"
              value="#57534E"
              swatchClassName="bg-ink-secondary"
            />
            <Swatch
              name="Ink tertiary"
              value="#78716C"
              swatchClassName="bg-ink-tertiary"
            />
          </div>
          <p className="max-w-2xl text-label text-ink-secondary">
            Ink on paper measures 17.1:1. Secondary ink measures 7.4:1 and carries
            body copy. Tertiary ink measures 4.7:1 and is reserved for labels,
            units and timestamps — never for a sentence a patient has to read.
          </p>
        </Subsection>
      </Section>

      <Section
        index="02"
        title="Type scale"
        blurb="Ask of any string: is this language, or is this measurement? Language takes the serif. Measurement takes the sans, in tabular figures."
      >
        <Subsection title="Instrument Serif — what Mend says">
          <div className="space-y-7">
            <Specimen
              className="font-heading text-display"
              name="display"
              size="64px"
              face="Instrument Serif"
            >
              You&apos;re on track
            </Specimen>
            <Specimen
              className="font-heading text-title"
              name="title"
              size="44px"
              face="Instrument Serif"
            >
              Day 3 after your hip replacement
            </Specimen>
            <Specimen
              className="font-heading text-heading"
              name="heading"
              size="32px"
              face="Instrument Serif"
            >
              What Mend asked this morning
            </Specimen>
            <Specimen
              className="font-heading text-subhead"
              name="subhead"
              size="24px"
              face="Instrument Serif"
            >
              Situation, background, assessment, recommendation
            </Specimen>
            <Specimen
              className="font-serif text-lede"
              name="lede"
              size="21px"
              face="Instrument Serif"
            >
              &ldquo;Good morning, Margaret. Yesterday you told me the pain was a
              four out of ten. How is it this morning?&rdquo;
            </Specimen>
          </div>
        </Subsection>

        <Subsection title="Inter — what the engine measures">
          <div className="space-y-7">
            <Specimen
              className="numeric text-vital font-medium"
              name="vital"
              size="44px"
              face="Inter"
            >
              122 <span className="text-label text-ink-tertiary">bpm</span>
            </Specimen>
            <Specimen
              className="text-body-lg"
              name="body-lg"
              size="19px"
              face="Inter"
            >
              Family view body copy sits at nineteen pixels, because the person
              reading it is often worried and often not wearing their glasses.
            </Specimen>
            <Specimen className="text-body" name="body" size="17px" face="Inter">
              Product body copy sits at seventeen pixels with a 1.6 line height.
              Nothing in Mend renders body text below this size.
            </Specimen>
            <Specimen
              className="text-label font-medium"
              name="label"
              size="15px"
              face="Inter"
            >
              Captured from KardiaMobile 6L
            </Specimen>
            <Specimen
              className="numeric text-meta text-ink-secondary"
              name="meta"
              size="13px"
              face="Inter"
            >
              2026-07-25 09:12 · RED-PE-01 · 122 bpm · 93% · 38.4 °C
            </Specimen>
            <Specimen className="eyebrow" name="eyebrow" size="13px" face="Inter">
              Deterministic core
            </Specimen>
          </div>
          <p className="max-w-2xl text-label text-ink-secondary">
            Every numeric readout carries{" "}
            <span className="numeric font-medium text-ink">
              font-variant-numeric: tabular-nums
            </span>
            , so a heart rate of 111 occupies exactly the width of 122 and a
            column of readings never shifts between refreshes.
          </p>
        </Subsection>
      </Section>

      <Section
        index="03"
        title="Severity"
        blurb="The only saturated colour in Mend. One source of truth in lib/ui/severity.ts, and never colour on its own."
      >
        <Subsection title="Chips">
          <div className="space-y-4">
            {(["lg", "md", "sm"] as const).map((size) => (
              <div key={size} className="flex flex-wrap items-center gap-3">
                <span className="numeric w-8 text-meta text-ink-tertiary">
                  {size}
                </span>
                {SEVERITY_LEVELS.map((level) => (
                  <SeverityChip key={level} level={level} size={size} />
                ))}
              </div>
            ))}
          </div>
        </Subsection>

        <Subsection title="Panel">
          <div className="space-y-4">
            <SeverityPanel level="red">
              Breathlessness with a heart rate of 122 and oxygen saturation of 93%
              on day 3. Mend has paged the on-call surgeon and told Margaret to
              call 911.
            </SeverityPanel>
            <SeverityPanel level="green">
              Yesterday&apos;s check-in was complete and every reading sat inside
              the day-2 envelope. Nothing needs a clinician today.
            </SeverityPanel>
          </div>
        </Subsection>

        <Subsection title="Tokens">
          <div className="grid gap-5 sm:grid-cols-3">
            {SEVERITY_LEVELS.map((level) => {
              const token = SEVERITY[level];
              return (
                <div
                  key={level}
                  className="space-y-5 rounded-xl border border-line bg-raised p-5 shadow-card"
                >
                  <SeverityChip level={level} size="sm" />
                  <dl className="space-y-2.5">
                    {[
                      ["Foreground", token.fg],
                      ["Background", token.bg],
                      ["Border", token.border],
                      ["Icon", token.iconName],
                      ["Contrast", `${severityContrast(level).toFixed(2)}:1`],
                    ].map(([term, value]) => (
                      <div
                        key={term}
                        className="flex items-baseline justify-between gap-3 text-meta"
                      >
                        <dt className="text-ink-tertiary">{term}</dt>
                        <dd className="numeric font-medium text-ink-secondary">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="max-w-2xl text-label text-ink-secondary">
            A severity is never drawn from a class name. It is drawn from the
            token, which carries its icon and its label with it — so a screen
            cannot ship colour-only signalling, and a washed-out projector still
            reads &ldquo;Urgent&rdquo;. Contrast is computed from the tokens
            themselves, not asserted.
          </p>
        </Subsection>
      </Section>

      <Section
        index="04"
        title="Readouts"
        blurb="Measurement in tabular sans, judgement in a severity chip, provenance in the meta line. Each value carries an aria-label that reads as a sentence."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Vital
            label="Heart rate"
            value="122"
            unit="bpm"
            level="red"
            reading="Heart rate 122 beats per minute, above the expected range for day 3"
            captured="09:12"
          />
          <Vital
            label="Oxygen"
            value="93"
            unit="%"
            level="amber"
            reading="Oxygen saturation 93 percent, below the expected range for day 3"
            captured="09:12"
          />
          <Vital
            label="Temperature"
            value="38.4"
            unit="°C"
            level="amber"
            reading="Temperature 38.4 degrees Celsius, above the expected range for day 3"
            captured="09:12"
          />
          <Vital
            label="Pain"
            value="4"
            unit="/ 10"
            level="green"
            reading="Pain score 4 out of 10, controlled and improving since yesterday"
            captured="09:12"
          />
        </div>

        <Subsection title="Engine trace">
          <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Fired</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RULES.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="numeric font-medium whitespace-nowrap">
                      {rule.id}
                    </TableCell>
                    <TableCell className="numeric whitespace-nowrap text-ink-secondary">
                      {rule.fired}
                    </TableCell>
                    <TableCell className="text-ink-secondary">
                      {rule.finding}
                    </TableCell>
                    <TableCell>
                      <SeverityChip level={rule.level} size="sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Subsection>
      </Section>

      <Section
        index="05"
        title="Components"
        blurb="shadcn primitives moved onto the warm palette. Every interactive target is at least 44 by 44 pixels, whatever its size variant."
      >
        <Subsection title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Start check-in</Button>
            <Button variant="outline">Listen to the call</Button>
            <Button variant="secondary">Mark reviewed</Button>
            <Button variant="destructive">Escalate now</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost">Dismiss</Button>
            <Button variant="link">View clinical rationale</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Large</Button>
            <Button size="default">Default</Button>
            <Button size="sm">Small</Button>
            <Button size="xs">Extra small</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Subsection>

        <Subsection title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Day 3</Badge>
            <Badge variant="secondary">Total hip replacement</Badge>
            <Badge variant="outline">KardiaMobile 6L</Badge>
            <Badge variant="ghost">Simulated</Badge>
          </div>
        </Subsection>

        <Subsection title="Card">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>What Mend said</CardTitle>
                <CardDescription>
                  Day 3 morning check-in · 2 minutes 14 seconds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-serif text-lede text-ink">
                  &ldquo;You said you&apos;re more breathless than yesterday and
                  your heart is racing. I&apos;m going to ask you to call 911 now
                  — I&apos;ve already told your surgeon&apos;s team.&rdquo;
                </p>
                <Separator />
                <p className="numeric text-meta text-ink-tertiary">
                  Transcribed 09:12 · escalated 09:13 · acknowledged 09:15
                </p>
              </CardContent>
              <CardFooter className="justify-between gap-4">
                <SeverityChip level="red" size="sm" />
                <Button variant="outline" size="sm">
                  Open transcript
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loading state</CardTitle>
                <CardDescription>
                  Skeletons hold the layout so nothing jumps when the reading
                  lands.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-11 w-2/3" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </Subsection>

        <Subsection title="Tabs">
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="vitals">Vitals</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="pt-6">
              <p className="max-w-2xl font-serif text-lede text-ink">
                Margaret is three days out from a right total hip replacement and
                reported new breathlessness this morning.
              </p>
            </TabsContent>
            <TabsContent value="vitals" className="pt-6">
              <p className="numeric max-w-2xl text-body text-ink-secondary">
                HR 122 bpm · SpO₂ 93% · Temp 38.4 °C · BP 104/68 mmHg
              </p>
            </TabsContent>
            <TabsContent value="transcript" className="pt-6">
              <p className="max-w-2xl font-serif text-lede text-ink">
                &ldquo;I got up to the bathroom and I had to sit down halfway. My
                chest feels tight.&rdquo;
              </p>
            </TabsContent>
          </Tabs>
        </Subsection>

        <Subsection title="Dialog and toasts">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                Review escalation
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Escalate to the on-call surgeon?</DialogTitle>
                  <DialogDescription>
                    RED-PE-01 fired at 09:12. The SBAR handoff is drafted and will
                    be sent with the last three readings attached.
                  </DialogDescription>
                </DialogHeader>
                <SeverityPanel level="red">
                  Suspected pulmonary embolism on day 3 after right total hip
                  replacement.
                </SeverityPanel>
                <DialogFooter showCloseButton>
                  <Button variant="destructive">Send handoff</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ToastDemo />
          </div>
        </Subsection>
      </Section>

      <Section
        index="06"
        title="Rules"
        blurb="These are binding on every screen that consumes this system."
      >
        <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card sm:grid-cols-2">
          {[
            [
              "No accent colour",
              "If a screen needs a colour that is not one of the three severities, the screen is wrong.",
            ],
            [
              "Never colour alone",
              "Severity always renders through lib/ui/severity.ts, which carries an icon and a label with the colour.",
            ],
            [
              "Serif is language",
              "Headings, summaries, what Mend said, SBAR prose. Never below 20px, never faux-bold.",
            ],
            [
              "Sans is measurement",
              "Vitals, timestamps, trend values, rule ids — always in tabular figures.",
            ],
            [
              "44 by 44",
              "Every button, tab and link clears a 44px hit area at every size variant.",
            ],
            [
              "Motion is optional",
              "Every transition collapses to 0.01ms under prefers-reduced-motion.",
            ],
          ].map(([title, body]) => (
            <li key={title} className="space-y-2 bg-raised p-6">
              <p className="text-label font-medium text-ink">{title}</p>
              <p className="text-label text-ink-secondary">{body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </main>
  );
}
