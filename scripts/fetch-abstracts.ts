/**
 * Fetches abstracts for one threshold's candidate papers, so the reading list
 * can actually be adjudicated rather than just admired.
 *
 *   npm run abstracts -- --rule postop-fever-envelope
 *   npm run abstracts -- --rule postop-fever-envelope --all   # every match, not just the top hits
 *
 * Abstract-level reading is a triage step, not a substitute for the paper. An
 * abstract routinely omits the exact cut-point, the denominator, and the
 * population — which are precisely the things a threshold depends on. Anything
 * that survives this pass still needs the full text before it becomes a number
 * that tells someone to call 911.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EVIDENCE_QUERIES } from "../lib/data/evidence-queries";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const KEY = process.env.NCBI_API_KEY;
const DELAY = KEY ? 110 : 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const RULE = arg("rule");
const ALL = process.argv.includes("--all");

if (!RULE) {
  console.error(
    "Usage: npm run abstracts -- --rule <ruleId> [--all]\n\nKnown rules:\n  " +
      EVIDENCE_QUERIES.map((q) => q.ruleId).join("\n  "),
  );
  process.exit(1);
}

const query = EVIDENCE_QUERIES.find((q) => q.ruleId === RULE);
if (!query) {
  console.error(`Unknown rule "${RULE}".`);
  process.exit(1);
}

async function eutilsJson(path: string, params: Record<string, string>) {
  const q = new URLSearchParams({
    ...params,
    retmode: "json",
    tool: "mend-prototype",
    email: "noreply@example.invalid",
    ...(KEY ? { api_key: KEY } : {}),
  });
  const res = await fetch(`${EUTILS}/${path}?${q}`);
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json();
}

/** efetch returns XML for abstracts; parsed with regex because the shape is shallow and stable. */
async function fetchAbstracts(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const q = new URLSearchParams({
      db: "pubmed",
      id: batch.join(","),
      rettype: "abstract",
      retmode: "xml",
      tool: "mend-prototype",
      email: "noreply@example.invalid",
      ...(KEY ? { api_key: KEY } : {}),
    });
    const xml = await (await fetch(`${EUTILS}/efetch.fcgi?${q}`)).text();
    for (const article of xml.split("<PubmedArticle>").slice(1)) {
      const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
      if (!pmid) continue;
      const parts = [...article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(
        (m) => {
          const label = m[0].match(/Label="([^"]+)"/)?.[1];
          const body = m[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim();
          return label ? `${label}: ${body}` : body;
        },
      );
      out.set(pmid, parts.join("\n") || "(no abstract available)");
    }
    await sleep(DELAY);
  }
  return out;
}

async function main() {
  // Prefer the PMIDs already retrieved, so the abstract pass reads exactly the
  // papers the reading list points at rather than a fresh, possibly different set.
  const candPath = join(process.cwd(), "data", "evidence", "candidates.json");
  let ids: string[] = [];

  if (!ALL && existsSync(candPath)) {
    const raw = JSON.parse(readFileSync(candPath, "utf8"));
    const rule = (raw.rules ?? []).find((r: { ruleId: string }) => r.ruleId === RULE);
    ids = (rule?.papers ?? []).map((p: { pmid: string }) => p.pmid);
  }

  if (!ids.length) {
    const s = await eutilsJson("esearch.fcgi", {
      db: "pubmed",
      term: query!.term,
      retmax: ALL ? "200" : "20",
      sort: "relevance",
    });
    ids = s?.esearchresult?.idlist ?? [];
    await sleep(DELAY);
  }

  console.log(`${RULE}: fetching ${ids.length} abstracts…`);
  const abstracts = await fetchAbstracts(ids);
  const summ = await eutilsJson("esummary.fcgi", { db: "pubmed", id: ids.join(",") });

  const md: string[] = [
    `# Abstracts — ${RULE}`,
    "",
    `**Claim a human must verify:** ${query!.claimToVerify}`,
    "",
    `**Where the threshold lives:** \`${query!.location}\``,
    "",
    "> Abstract-level reading is triage. Abstracts routinely omit the exact cut-point,",
    "> the denominator, and the population — the three things a threshold depends on.",
    "> Anything that survives this pass still needs the full text.",
    "",
    "---",
    "",
  ];

  for (const id of ids) {
    const r = summ?.result?.[id];
    if (!r) continue;
    md.push(`## ${r.title?.replace(/\s+$/, "") ?? "(untitled)"}`);
    md.push("");
    md.push(
      `PMID [${id}](https://pubmed.ncbi.nlm.nih.gov/${id}/) · ${r.source ?? ""} · ${(r.pubdate ?? "").slice(0, 4)}`,
    );
    md.push("");
    md.push(abstracts.get(id) ?? "(no abstract available)");
    md.push("");
  }

  const out = join(process.cwd(), "data", "evidence", `abstracts-${RULE}.md`);
  writeFileSync(out, md.join("\n"));
  console.log(`written to data/evidence/abstracts-${RULE}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
