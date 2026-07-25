/**
 * Pulls candidate literature from PubMed for every uncited threshold.
 *
 *   npm run evidence            # default 12 hits per rule
 *   npm run evidence -- --hits 25
 *
 * Uses NCBI E-utilities, which needs no key at up to 3 requests/second. Set
 * NCBI_API_KEY to raise that to 10/sec.
 *
 * ⚠️ THIS DOES NOT CITE ANYTHING. It produces a ranked reading list. A search
 * engine cannot confirm that a threshold came from a paper, and presenting
 * retrieved PMIDs as provenance would manufacture the appearance of evidence —
 * which is worse than admitting there is none. A human still has to read these
 * and decide.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EVIDENCE_QUERIES, EvidenceQuery } from "../lib/data/evidence-queries";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const KEY = process.env.NCBI_API_KEY;
const DELAY_MS = KEY ? 110 : 350; // stay under the documented rate limits

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

const HITS = arg("hits", 12);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Paper {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  authors: string;
  doi?: string;
  url: string;
}

interface RuleEvidence extends EvidenceQuery {
  totalMatches: number;
  retrieved: number;
  papers: Paper[];
  error?: string;
}

async function eutils(path: string, params: Record<string, string>) {
  const q = new URLSearchParams({
    ...params,
    retmode: "json",
    tool: "mend-prototype",
    email: "noreply@example.invalid",
    ...(KEY ? { api_key: KEY } : {}),
  });
  const res = await fetch(`${EUTILS}/${path}?${q}`);
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  return res.json();
}

async function search(term: string): Promise<{ ids: string[]; count: number }> {
  const j = await eutils("esearch.fcgi", {
    db: "pubmed",
    term,
    retmax: String(HITS),
    sort: "relevance",
  });
  return {
    ids: j?.esearchresult?.idlist ?? [],
    count: Number(j?.esearchresult?.count ?? 0),
  };
}

async function summarise(ids: string[]): Promise<Paper[]> {
  if (!ids.length) return [];
  const j = await eutils("esummary.fcgi", { db: "pubmed", id: ids.join(",") });
  const result = j?.result ?? {};
  return ids
    .map((id): Paper | null => {
      const r = result[id];
      if (!r) return null;
      const doi = (r.articleids ?? []).find(
        (a: { idtype: string }) => a.idtype === "doi",
      )?.value;
      const authors = (r.authors ?? [])
        .slice(0, 3)
        .map((a: { name: string }) => a.name)
        .join(", ");
      return {
        pmid: id,
        title: r.title?.replace(/\s+/g, " ").trim() ?? "(no title)",
        journal: r.source ?? "",
        year: (r.pubdate ?? "").slice(0, 4),
        authors: authors + ((r.authors ?? []).length > 3 ? ", et al." : ""),
        doi,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    })
    .filter((p): p is Paper => p !== null);
}

async function main() {
  console.log(
    `Querying PubMed for ${EVIDENCE_QUERIES.length} thresholds, ${HITS} hits each` +
      (KEY ? " (using NCBI_API_KEY)" : " (no API key — 3 req/sec)"),
  );

  const out: RuleEvidence[] = [];

  for (const q of EVIDENCE_QUERIES) {
    process.stdout.write(`  ${q.ruleId.padEnd(30)}`);
    try {
      const { ids, count } = await search(q.term);
      await sleep(DELAY_MS);
      const papers = await summarise(ids);
      await sleep(DELAY_MS);
      out.push({ ...q, totalMatches: count, retrieved: papers.length, papers });
      console.log(`${String(count).padStart(7)} matches, ${papers.length} retrieved`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      out.push({ ...q, totalMatches: 0, retrieved: 0, papers: [], error: msg });
      console.log(`FAILED — ${msg}`);
    }
  }

  const dir = join(process.cwd(), "data", "evidence");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "candidates.json"),
    JSON.stringify({ retrievedAt: new Date().toISOString(), hitsPerRule: HITS, rules: out }, null, 2) + "\n",
  );

  // A markdown worklist, because the next step is a human reading these.
  const md: string[] = [
    "# Candidate evidence — reading list",
    "",
    "**Retrieved from PubMed. Nothing here is a citation yet.**",
    "",
    "A search returns candidates. It cannot confirm a threshold came from a paper,",
    "and it cannot tell you whether a threshold validated on an examined patient",
    "transfers to a phone call and four vitals. Each row below is something to read",
    "and adjudicate, not something to cite.",
    "",
    "Workflow: read → decide *supports / refutes / irrelevant* → record the verdict",
    "and the adjusted threshold in `docs/CLINICAL_SOURCES.md` → get it signed off.",
    "",
    `Retrieved ${new Date().toISOString().slice(0, 10)} · ${HITS} hits per threshold.`,
    "",
  ];

  for (const r of out) {
    md.push(`## ${r.ruleId}`);
    md.push("");
    md.push(`**Where:** \`${r.location}\``);
    md.push("");
    md.push(`**Claim a human must verify:** ${r.claimToVerify}`);
    md.push("");
    if (r.error) {
      md.push(`> Retrieval failed: ${r.error}`);
      md.push("");
      continue;
    }
    md.push(`${r.totalMatches.toLocaleString()} papers match this query; top ${r.papers.length} by relevance:`);
    md.push("");
    md.push("| | PMID | Year | Journal | Title |");
    md.push("|---|---|---|---|---|");
    r.papers.forEach((p, i) => {
      const t = p.title.replace(/\|/g, "\\|");
      md.push(`| ☐ | [${p.pmid}](${p.url}) | ${p.year} | ${p.journal} | ${t} |`);
    });
    md.push("");
    md.push("<details><summary>PubMed query used</summary>");
    md.push("");
    md.push("```");
    md.push(r.term);
    md.push("```");
    md.push("");
    md.push("</details>");
    md.push("");
  }

  writeFileSync(join(dir, "READING-LIST.md"), md.join("\n"));

  const failed = out.filter((r) => r.error).length;
  const totalPapers = out.reduce((a, r) => a + r.papers.length, 0);
  console.log(
    `\n${totalPapers} candidate papers across ${out.length - failed}/${out.length} thresholds` +
      `\nwritten to data/evidence/READING-LIST.md and candidates.json`,
  );
  console.log(
    "\nThese are candidates, not citations. Read and adjudicate before anything\n" +
      "here goes into docs/CLINICAL_SOURCES.md.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
