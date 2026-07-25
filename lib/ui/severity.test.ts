import { describe, expect, it } from "vitest";
import {
  SEVERITY,
  SEVERITY_LEVELS,
  highestSeverity,
  severityContrast,
  severityRank,
  severityStyle,
  severityToken,
} from "@/lib/ui/severity";

const HEX = /^#[0-9A-F]{6}$/;

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("severity tokens", () => {
  it("covers every severity level exactly once", () => {
    expect(SEVERITY_LEVELS).toEqual(["green", "amber", "red"]);
    expect(Object.keys(SEVERITY).sort()).toEqual(
      [...SEVERITY_LEVELS].sort()
    );
  });

  for (const level of SEVERITY_LEVELS) {
    describe(level, () => {
      const token = SEVERITY[level];

      // Colour-only signalling is the failure mode this suite exists to prevent.
      it("exposes a non-empty icon", () => {
        // lucide components are memo/forwardRef objects, not plain functions.
        expect(token.icon).toBeTruthy();
        expect(["function", "object"]).toContain(typeof token.icon);
        expect(token.iconName.trim().length).toBeGreaterThan(0);
      });

      it("exposes a non-empty text label", () => {
        expect(token.label.trim().length).toBeGreaterThan(0);
      });

      it("exposes a plain-language description for assistive technology", () => {
        expect(token.description.trim().length).toBeGreaterThan(0);
        expect(token.description).toMatch(/\.$/);
      });

      it("uses uppercase six-digit hex for every colour", () => {
        expect(token.fg).toMatch(HEX);
        expect(token.bg).toMatch(HEX);
        expect(token.border).toMatch(HEX);
      });

      it("meets WCAG AA contrast for body text on its own background", () => {
        expect(contrastRatio(token.fg, token.bg)).toBeGreaterThanOrEqual(4.5);
      });

      it("reports the same ratio the styleguide prints", () => {
        expect(severityContrast(level)).toBeCloseTo(
          contrastRatio(token.fg, token.bg),
          2
        );
      });

      it("stays legible on warm paper as well as on its own chip", () => {
        expect(contrastRatio(token.fg, "#FDFCFA")).toBeGreaterThanOrEqual(4.5);
      });

      it("reports itself under its own key", () => {
        expect(token.level).toBe(level);
        expect(severityToken(level)).toBe(token);
      });
    });
  }

  it("gives distinct icons and labels per level, so levels are never confusable", () => {
    const icons = SEVERITY_LEVELS.map((l) => SEVERITY[l].iconName);
    const labels = SEVERITY_LEVELS.map((l) => SEVERITY[l].label);
    expect(new Set(icons).size).toBe(SEVERITY_LEVELS.length);
    expect(new Set(labels).size).toBe(SEVERITY_LEVELS.length);
  });
});

describe("severityStyle", () => {
  it("returns only token colours", () => {
    expect(severityStyle("red")).toEqual({
      color: SEVERITY.red.fg,
      backgroundColor: SEVERITY.red.bg,
      borderColor: SEVERITY.red.border,
    });
  });
});

describe("severity ordering", () => {
  it("ranks green below amber below red", () => {
    expect(severityRank("green")).toBeLessThan(severityRank("amber"));
    expect(severityRank("amber")).toBeLessThan(severityRank("red"));
  });

  it("surfaces the worst level in a mixed set", () => {
    expect(highestSeverity(["green", "amber"])).toBe("amber");
    expect(highestSeverity(["green", "red", "amber"])).toBe("red");
    expect(highestSeverity(["green"])).toBe("green");
  });

  it("defaults to green for an empty set", () => {
    expect(highestSeverity([])).toBe("green");
  });
});
