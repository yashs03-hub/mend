/**
 * Second, independent evidence pass using Elicit's semantic search, merged with
 * the PubMed results.
 *
 *   ELICIT_API_KEY=... npm run evidence:elicit
 *   ELICIT_API_KEY=... npm run evidence:elicit -- --review postop-fever-envelope
 *
 * WHY BOTH. PubMed is boolean/MeSH: excellent recall on precise terminology,
 * poor at a conceptual question like "what temperature cut-point does the
 * literature support?". Elicit is semantic: good at the concept, weaker at
 * exhaustive term coverage. They fail in opposite directions, so a paper
 * surfaced by BOTH — independently — is a stronger candidate than one surfaced
 * by either alone. That agreement is the signal this script computes.
 *
 * WHAT IT STILL IS NOT. Semantic retrieval is not verification, and neither is
 * LLM extraction. A threshold that will tell an 82-year-old to call 911 needs a
 * human who has read the paper and a clinician who has signed it off. This
 * narrows the reading list; it does not close it.
 *
 * The key is yours to create — https://elicit.com/settings, Pro plan or above.
 * Set it in your shell or .env.local; never commit it.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EVIDENCE_QUERIES } from "../lib/data/evidence-queries";

const API = "https://elicit.com/api/v2";
const KEY = process.env.ELICIT_API_KEY;

if (!KEY) {
  console.error(
    "ELICIT_API_KEY is not set.\n\n" +
      "  1. Generate a key at https://elicit.com/settings (Pro plan or above)\n" +
      "  2. export ELICIT_API_KEY=elk_live_...\n" +
      "  3. npm run evidence:elicit\n\n" +
      "PubMed retrieval needs no key and already works: npm run evidence",
  );
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const MAX_RESULTS = Number(arg("max") ?? 15);
const REVIEW_RULE = arg("review");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ElicitPaper {
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  doi?: string;
  pmid?: string;
  elicitId?: string;
  venue?: string;
  citedByCount?: number;
}

async function elicit<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} -> HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function searchPapers(query: string): Promise<ElicitPaper[]> {
  const j = await elicit<{ papers: ElicitPaper[]; warnings?: string[] }>(
    "/search/papers",
    {
      query,
      corpus: "elicit",
      searchMode: "semantic",
      maxResults: MAX_RESULTS,
      // Peer-reviewed, retrievable, and recent enough that the guidance has not
      // been superseded. Deliberately loose — this is a reading list, and
      // over-filtering here silently hides the paper you needed.
      filters: { minYear: 1995, retracted: false },
    },
  );
  return j.papers ?? [];
}

// ---------------------------------------------------------------------------
// Optional: a full screened + extracted systematic review for ONE threshold.
// Gated behind an explicit flag because it is asynchronous and consumes quota.
// ---------------------------------------------------------------------------
async function runReview(ruleId: string) {
  const q = EVIDENCE_QUERIES.find((x) => x.ruleId === ruleId);
  if (!q) {
    console.error(
      `Unknown rule "${ruleId}". Known: ${EVIDENCE_QUERIES.map((x) => x.ruleId).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Starting an Elicit systematic review for: ${ruleId}`);
  console.log(`Question: ${q.claimToVerify}\n`);

  const started = await elicit<{ sessionId: string; url?: string }>(
    "/sessions/systematic-reviews",
    {
      researchQuestion: q.claimToVerify,
      searches: [{ query: q.claimToVerify }],
      abstractScreening: true,
      fulltextScreening: true,
      extraction: true,
      generateReport: true,
      isPublic: false,
    },
  );

  console.log(`session ${started.sessionId}`);
  if (started.url) console.log(`watch:   ${started.url}`);
  console.log("polling (this takes several minutes)…\n");

  for (let i = 0; i < 120; i++) {
    await sleep(15_000);
    const s = await elicit<{
      status: string;
      executionStage?: string;
      data?: Record<string, unknown>;
      result?: { reportBody?: string; summary?: string };
    }>(`/sessions/systematic-reviews/${started.sessionId}`, undefined, "GET");

    process.stdout.write(`\r  ${s.status}${s.executionStage ? ` · ${s.executionStage}` : ""}      `);

    if (s.status === "completed") {
      const dir = join(process.cwd(), "data", "evidence");
      writeFileSync(
        join(dir, `review-${ruleId}.json`),
        JSON.stringify(s, null, 2) + "\n",
      );
      if (s.result?.reportBody) {
        writeFileSync(
          join(dir, `review-${ruleId}.md`),
          `# Elicit systematic review — ${ruleId}\n\n` +
            `> Machine-generated screening and extraction. Every extracted value must be\n` +
            `> checked against the paper before it becomes a threshold in this product.\n\n` +
            `**Question:** ${q.claimToVerify}\n\n---\n\n${s.result.reportBody}\n`,
        );
      }
      console.log(`\n\nwritten to data/evidence/review-${ruleId}.{json,md}`);
      console.log(
        "\nThe extraction is an LLM reading papers. Check every value you intend to use.",
      );
      return;
    }
    if (s.status === "failed" || s.status === "pausedForInsufficientQuota") {
      console.log(`\n\nstopped: ${s.status}`);
      return;
    }
  }
  console.log("\n\nstill running — check the session URL above.");
}

// ---------------------------------------------------------------------------
// Default: semantic search per threshold, cross-referenced against PubMed.
// ---------------------------------------------------------------------------
function normaliseDoi(d?: string) {
  return d?.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
}

async function main() {
  if (REVIEW_RULE) return runReview(REVIEW_RULE);

  // PubMed results are optional — the cross-reference is a bonus, not a
  // dependency, so a missing file degrades rather than fails.
  const pubmedPath = join(process.cwd(), "data", "evidence", "candidates.json");
  const pubmed: Record<string, { pmids: Set<string>; dois: Set<string> }> = {};
  if (existsSync(pubmedPath)) {
    const raw = JSON.parse(readFileSync(pubmedPath, "utf8"));
    for (const r of raw.rules ?? []) {
      pubmed[r.ruleId] = {
        pmids: new Set((r.papers ?? []).map((p: { pmid: string }) => p.pmid)),
        dois: new Set(
          (r.papers ?? [])
            .map((p: { doi?: string }) => normaliseDoi(p.doi))
            .filter(Boolean),
        ),
      };
    }
    console.log(`Cross-referencing against PubMed results for ${Object.keys(pubmed).length} thresholds.\n`);
  } else {
    console.log("No PubMed results found (run `npm run evidence` first to enable cross-referencing).\n");
  }

  const md: string[] = [
    "# Candidate evidence — Elicit semantic pass",
    "",
    "**Nothing here is a citation.** Semantic retrieval narrows a reading list; it does",
    "not verify that a threshold came from a paper, and it cannot judge whether a value",
    "validated on an examined patient survives the move to a phone call and four vitals.",
    "",
    "**★ marks a paper found independently by both the PubMed boolean search and this",
    "semantic search.** The two methods fail in opposite directions, so agreement between",
    "them is a genuine signal of centrality — and the sensible place to start reading.",
    "",
    `Retrieved ${new Date().toISOString().slice(0, 10)} · up to ${MAX_RESULTS} per threshold.`,
    "",
  ];

  let bothCount = 0;
  let total = 0;

  for (const q of EVIDENCE_QUERIES) {
    process.stdout.write(`  ${q.ruleId.padEnd(30)}`);
    let papers: ElicitPaper[] = [];
    try {
      // Search the CLAIM, not the boolean term — semantic search is better at a
      // question than at a query string, and asking it the same boolean would
      // waste the one thing it does better than PubMed.
      papers = await searchPapers(q.claimToVerify);
      console.log(`${String(papers.length).padStart(3)} papers`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.log(`FAILED — ${msg}`);
      md.push(`## ${q.ruleId}\n\n> Retrieval failed: ${msg}\n`);
      continue;
    }
    await sleep(700); // well inside the 100 req/min ceiling

    md.push(`## ${q.ruleId}`);
    md.push("");
    md.push(`**Where:** \`${q.location}\``);
    md.push("");
    md.push(`**Claim a human must verify:** ${q.claimToVerify}`);
    md.push("");
    md.push("| | Both? | Year | Cites | Title |");
    md.push("|---|---|---|---|---|");

    for (const p of papers) {
      total++;
      const pm = pubmed[q.ruleId];
      const inBoth = Boolean(
        pm &&
          ((p.pmid && pm.pmids.has(p.pmid)) ||
            (normaliseDoi(p.doi) && pm.dois.has(normaliseDoi(p.doi)!))),
      );
      if (inBoth) bothCount++;
      const link = p.doi
        ? `https://doi.org/${normaliseDoi(p.doi)}`
        : p.pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`
          : undefined;
      const title = p.title.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
      md.push(
        `| ☐ | ${inBoth ? "★" : ""} | ${p.year ?? ""} | ${p.citedByCount ?? ""} | ${
          link ? `[${title}](${link})` : title
        } |`,
      );
    }
    md.push("");
  }

  const dir = join(process.cwd(), "data", "evidence");
  writeFileSync(join(dir, "READING-LIST-ELICIT.md"), md.join("\n"));

  console.log(
    `\n${total} candidate papers; ${bothCount} also found by the PubMed search (★).` +
      `\nwritten to data/evidence/READING-LIST-ELICIT.md`,
  );
  console.log(
    "\nStart with the ★ rows. Then, for the load-bearing threshold:" +
      "\n  npm run evidence:elicit -- --review postop-fever-envelope",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
