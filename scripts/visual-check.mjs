/**
 * Visual verification harness.
 *
 * Captures every product surface at the viewports that matter for this project and
 * writes them to .visual/ for human and agent inspection. Also runs automated
 * accessibility-adjacent checks that a build cannot catch: contrast of severity
 * chips, presence of a non-colour severity cue, and touch target sizing.
 *
 *   node scripts/visual-check.mjs            capture everything
 *   node scripts/visual-check.mjs /styleguide  capture one route
 *
 * Assumes a dev server is already running on PORT (default 3000).
 */
import { chromium } from "playwright";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const OUT = path.resolve(".visual");

// 1920x1080 is the projector the demo is judged on; 390x844 is the phone the
// daughter actually opens the family view on.
const VIEWPORTS = [
  { name: "projector", width: 1920, height: 1080 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

// Default set includes the demo peak frames so every harness run covers them —
// bare `/call` and `/family` alone miss escalated takeover and attention state.
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "/",
      "/styleguide",
      "/call",
      "/call?stage=escalated",
      "/family",
      "/family?state=attention",
      "/clinician",
      "/clinician/engine",
      "/console",
    ];

/** Filesystem-safe route slug — query chars must not leak into filenames. */
const slug = (r) =>
  r === "/"
    ? "root"
    : r
        .replace(/^\//, "")
        .replace(/[/?=&]/g, "-")
        .replace(/-+/g, "-")
        .replace(/-$/, "");

/** WCAG relative luminance + contrast ratio, so we report numbers not vibes. */
function contrast(rgb1, rgb2) {
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const [a, b] = [lum(rgb1), lum(rgb2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const parseRgb = (s) => {
  const m = s.match(/(\d+(?:\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : null;
};

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const report = { base: BASE, capturedAt: new Date().toISOString(), routes: [] };

  for (const route of ROUTES) {
    const entry = { route, viewports: [], consoleErrors: [], status: null, checks: {} };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") entry.consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => entry.consoleErrors.push(`pageerror: ${e.message}`));

      let status = null;
      try {
        const res = await page.goto(`${BASE}${route}`, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
        status = res?.status() ?? null;
        await page.waitForTimeout(400); // let fonts settle so screenshots aren't FOUT
      } catch (err) {
        entry.consoleErrors.push(`navigation: ${err.message}`);
      }
      entry.status = status;

      const file = path.join(OUT, `${slug(route)}--${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      entry.viewports.push({ viewport: vp.name, file: path.relative(process.cwd(), file) });

      // Run the DOM-level checks once, at laptop width.
      if (vp.name === "laptop" && status === 200) {
        entry.checks = await page.evaluate(() => {
          const out = { severityChips: [], smallTargets: [], colourOnlyRisk: [] };

          for (const el of document.querySelectorAll("[data-severity]")) {
            const cs = getComputedStyle(el);
            const text = (el.textContent ?? "").trim();
            const hasIcon = !!el.querySelector("svg, [data-severity-icon]");
            out.severityChips.push({
              level: el.getAttribute("data-severity"),
              color: cs.color,
              backgroundColor: cs.backgroundColor,
              fontSize: cs.fontSize,
              hasIcon,
              hasText: text.length > 0,
              text: text.slice(0, 40),
            });
            // Severity must never be conveyed by colour alone.
            if (!hasIcon || text.length === 0) {
              out.colourOnlyRisk.push({
                level: el.getAttribute("data-severity"),
                hasIcon,
                hasText: text.length > 0,
              });
            }
          }

          for (const el of document.querySelectorAll(
            'button, a[href], [role="button"], input, select'
          )) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue; // not rendered
            if (r.width < 44 || r.height < 44) {
              out.smallTargets.push({
                tag: el.tagName.toLowerCase(),
                label: (el.textContent ?? "").trim().slice(0, 40),
                width: Math.round(r.width),
                height: Math.round(r.height),
              });
            }
          }
          return out;
        });

        // Compute real contrast ratios for each severity chip.
        for (const chip of entry.checks.severityChips ?? []) {
          const fg = parseRgb(chip.color);
          const bg = parseRgb(chip.backgroundColor);
          if (fg && bg) {
            chip.contrastRatio = Number(contrast(fg, bg).toFixed(2));
            const large = parseFloat(chip.fontSize) >= 24;
            chip.passesAA = chip.contrastRatio >= (large ? 3 : 4.5);
          }
        }
      }

      await context.close();
    }

    report.routes.push(entry);
    const bad = entry.consoleErrors.length;
    console.log(
      `${entry.status === 200 ? "ok  " : "MISS"} ${route.padEnd(20)} ` +
        `${entry.viewports.length} shots${bad ? `, ${bad} console error(s)` : ""}`
    );
  }

  await browser.close();
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const failures = report.routes.flatMap((r) => [
    ...(r.checks.colourOnlyRisk ?? []).map((c) => `${r.route}: severity "${c.level}" lacks icon or text`),
    ...(r.checks.severityChips ?? [])
      .filter((c) => c.passesAA === false)
      .map((c) => `${r.route}: severity "${c.level}" contrast ${c.contrastRatio} below AA`),
    ...(r.checks.smallTargets ?? []).map(
      (t) => `${r.route}: target "${t.label || t.tag}" is ${t.width}x${t.height}, under 44px`
    ),
  ]);

  console.log(`\nwrote ${OUT}/report.json`);
  if (failures.length) {
    console.log(`\n${failures.length} accessibility finding(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("\nno accessibility findings");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
