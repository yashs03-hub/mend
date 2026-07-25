import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Severity } from "@/lib/clinical/types";

/**
 * The single source of truth for how a severity level is presented.
 *
 * Severity is never communicated by colour alone: every token carries an icon
 * and a text label, and every renderer must show all three. This is an
 * accessibility requirement and insurance against a venue projector washing
 * the colour out.
 *
 * The hex values are mirrored as --color-severity-* custom properties in
 * app/globals.css; change both or neither.
 */
export interface SeverityToken {
  level: Severity;
  /** Text colour. Meets WCAG AA against `bg` at body size. */
  fg: string;
  /** Chip / panel fill. */
  bg: string;
  /** Hairline that separates the fill from warm paper. */
  border: string;
  icon: LucideIcon;
  /** Stable name for the icon, so tests and logs can assert on it. */
  iconName: string;
  /** Shown next to the icon. Never omitted. */
  label: string;
  /** One plain-language sentence, suitable for an aria-label or tooltip. */
  description: string;
}

export const SEVERITY_LEVELS = ["green", "amber", "red"] as const satisfies
  readonly Severity[];

export const SEVERITY: Record<Severity, SeverityToken> = {
  green: {
    level: "green",
    fg: "#15803D",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    icon: CheckCircle2,
    iconName: "CheckCircle2",
    label: "On track",
    description: "Recovery is on track. Keep going as planned.",
  },
  amber: {
    level: "amber",
    fg: "#B45309",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: AlertTriangle,
    iconName: "AlertTriangle",
    label: "Needs attention today",
    description: "Something needs a clinician's attention today, not tomorrow.",
  },
  red: {
    level: "red",
    fg: "#B91C1C",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: AlertOctagon,
    iconName: "AlertOctagon",
    label: "Urgent",
    description: "This needs urgent medical attention right now.",
  },
};

export function severityToken(level: Severity): SeverityToken {
  return SEVERITY[level];
}

/** Inline style for a severity surface, so the colour can only come from a token. */
export function severityStyle(level: Severity): CSSProperties {
  const token = SEVERITY[level];
  return {
    color: token.fg,
    backgroundColor: token.bg,
    borderColor: token.border,
  };
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  );
}

/** WCAG 2.1 contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Measured foreground-on-background contrast for a level, to two decimals. */
export function severityContrast(level: Severity): number {
  const token = SEVERITY[level];
  return Math.round(contrastRatio(token.fg, token.bg) * 100) / 100;
}

const RANK: Record<Severity, number> = { green: 0, amber: 1, red: 2 };

export function severityRank(level: Severity): number {
  return RANK[level];
}

/** The level a mixed set of findings should be presented as: the worst one. */
export function highestSeverity(levels: readonly Severity[]): Severity {
  return levels.reduce<Severity>(
    (worst, level) => (RANK[level] > RANK[worst] ? level : worst),
    "green"
  );
}
