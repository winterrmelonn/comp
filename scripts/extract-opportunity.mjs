// AI-assisted extraction: read an official scholarship/program page and draft a catalog entry for a human to approve.
// Nothing here edits data/catalog.json. Drafts go to data/candidates.json; a reviewer checks each one against the
// page (the "evidence" quotes make that quick) and copies approved entries into the catalog.
//
//   cd scripts && npm install
//   ANTHROPIC_API_KEY=... node extract-opportunity.mjs https://example.org/scholarship [more urls]
//   ANTHROPIC_API_KEY=... node extract-opportunity.mjs --due-soon    # re-read catalog items due this month or next
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const root = new URL('..', import.meta.url);
const CATALOG = new URL('data/catalog.json', root);
const CANDIDATES = new URL('data/candidates.json', root);
const MAX_CHARS = 120_000; // page text sent to Claude; longer pages are cut and the draft says so

const Entry = z.object({
  isOpportunity: z.boolean().describe('false if this page is not a scholarship, program, competition or volunteer opportunity for high school students'),
  kind: z.enum(['scholarship', 'program']),
  category: z.enum(['Scholarship', 'Summer program', 'Internship', 'Research', 'Competition', 'Hackathon', 'Leadership', 'Volunteering']),
  name: z.string(),
  org: z.string(),
  amount: z.number().nullable().describe('largest single award in USD, if stated'),
  amountText: z.string().nullable().describe('award as the page states it, e.g. "$2,500–$20,000"'),
  deadline: z.string().nullable().describe('next application deadline as YYYY-MM-DD, only if the page states a specific date for the current or upcoming cycle'),
  dueMonth: z.number().int().min(1).max(12).nullable().describe('usual deadline month if no exact upcoming date is stated'),
  rolling: z.boolean().describe('true if applications are accepted year-round'),
  grades: z.array(z.number().int().min(9).max(12)).describe('high school grades that can apply'),
  fields: z.array(z.enum(['stem', 'cs', 'math', 'arts', 'writing', 'humanities', 'leadership', 'service', 'general'])),
  basis: z.enum(['merit', 'need', 'both', 'contest']).nullable(),
  region: z.string().describe('"National" or the state/region it is limited to'),
  cost: z.enum(['free', 'aid', 'paid']).nullable().describe('programs only: cost to participate'),
  format: z.enum(['online', 'in_person']),
  summary: z.string().describe('one or two plain sentences a high schooler would find useful'),
  eligibility: z.string().describe('key requirements: citizenship, GPA, grade, location, etc.'),
  evidence: z.object({
    deadline: z.string().nullable().describe('exact quote from the page supporting the deadline'),
    amount: z.string().nullable().describe('exact quote supporting the amount'),
    eligibility: z.string().nullable().describe('exact quote supporting eligibility'),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  concerns: z.array(z.string()).describe('anything a reviewer should double-check: old dates, conflicting info, unclear eligibility'),
});

const SYSTEM = `You draft catalog entries for comp., a free site that helps U.S. high school students find scholarships and programs.
You will get the text of one official web page. Extract only what the page states. If something is not on the page, use null
(or an empty list) rather than guessing: a wrong deadline is worse than a missing one. Today is ${new Date().toISOString().slice(0, 10)};
a date from a past cycle is not the next deadline, so leave deadline null, set dueMonth from it, and add a concern.
Quote the page exactly in evidence. Write the summary in plain, friendly language.`;

const pageText = html => html
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '–')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function fetchPage(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; comp-catalog-bot; +https://winterrmelonn.github.io/comp/)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = pageText(await res.text());
  return { finalUrl: res.url, text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}

const client = new Anthropic();

async function extract(url, existing) {
  const page = await fetchPage(url);
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium', format: betaZodOutputFormat(Entry) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `${existing ? `This page is for an entry already in the catalog; check whether its details changed:\n${JSON.stringify(existing)}\n\n` : ''}URL: ${page.finalUrl}\n\nPage text:\n${page.text}`,
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`declined (${response.stop_details?.category ?? 'no category'})`);
  if (response.stop_reason === 'max_tokens') throw new Error('response cut off at max_tokens');
  const entry = response.parsed_output;
  if (!entry) throw new Error('no structured output returned');
  if (page.truncated) entry.concerns.push(`Page was longer than ${MAX_CHARS} characters; only the start was read.`);
  return { ...entry, url: page.finalUrl, sourceUrl: url, updates: existing?.id ?? null, extractedAt: new Date().toISOString(), status: 'pending' };
}

// Which pages to read
const args = process.argv.slice(2);
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
let targets;
if (args[0] === '--due-soon') {
  const m = new Date().getMonth() + 1;
  targets = catalog.items.filter(i => !i.deadline && [m, m % 12 + 1].includes(i.dueMonth)).map(i => ({ url: i.url, existing: i }));
} else if (args.length) {
  targets = args.map(url => ({ url, existing: catalog.items.find(i => i.url === url) }));
} else {
  console.error('Usage: node extract-opportunity.mjs <url> [url...]  |  --due-soon');
  process.exit(2);
}

const candidates = existsSync(CANDIDATES) ? JSON.parse(readFileSync(CANDIDATES, 'utf8')) : [];
for (const { url, existing } of targets) {
  try {
    const c = await extract(url, existing);
    candidates.push(c);
    const when = c.deadline || (c.dueMonth ? `usually month ${c.dueMonth}` : c.rolling ? 'rolling' : 'no date');
    console.log(`✓ ${c.name} · ${when} · ${c.amountText ?? ''} · confidence ${c.confidence}${c.concerns.length ? ` · ${c.concerns.length} concern(s)` : ''}`);
  } catch (err) {
    console.log(`✗ ${url}: ${err.message}`);
  }
  writeFileSync(CANDIDATES, JSON.stringify(candidates, null, 1) + '\n'); // save as we go
}
console.log(`\n${candidates.filter(c => c.status === 'pending').length} draft(s) waiting for review in data/candidates.json`);
