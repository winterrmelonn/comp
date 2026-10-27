// Weekly catalog check: is every link still up, and which deadlines need a human to re-confirm?
// Usage: node scripts/check-catalog.mjs [report.md]   (Node 20+; no dependencies)
// Prints a Markdown report and writes it to the given file. Exit code is 1 if anything needs attention.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const catalog = read('data/catalog.json');
const study = read('data/study.json');

const today = new Date().toISOString().slice(0, 10);
const days = d => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Every link, deduplicated, with where it's used
const links = new Map();
// Search links (YouTube, Khan Academy search) are generated queries, not pages that can go stale
const isSearch = url => /youtube\.com\/results|khanacademy\.org\/search/.test(url);
const use = (url, where) => { if (!isSearch(url)) links.set(url, [...(links.get(url) || []), where]); };
for (const i of catalog.items) use(i.url, `catalog: ${i.name}`);
for (const s of study.items) for (const r of s.resources) use(r.url, `study: ${s.name} → ${r.name}`);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function check(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
      res.body?.cancel();
      if (res.status === 429 && attempt < 2) { await sleep(5000 * (attempt + 1)); continue; }
      // 401/403/429 mean the site blocks bots, not that the page is gone
      const state = res.ok ? 'ok' : [401, 403, 429].includes(res.status) ? 'blocked' : 'broken';
      return { state, status: res.status, final: res.url !== url ? res.url : null };
    } catch (err) {
      if (attempt < 2) { await sleep(3000); continue; }
      const status = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || err.cause?.message || err.message);
      // Endless redirects are a bot wall (the page loads fine in a browser), not a dead link
      return { state: /redirect count exceeded/i.test(status) ? 'blocked' : 'broken', status };
    }
  }
}

// A few at a time, and one host at a time, so nobody gets hammered
const results = new Map();
const queue = [...links.keys()];
const busyHosts = new Set();
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const idx = queue.findIndex(u => !busyHosts.has(new URL(u).host));
    if (idx < 0) { await sleep(200); continue; }
    const [url] = queue.splice(idx, 1);
    const host = new URL(url).host;
    busyHosts.add(host);
    results.set(url, await check(url));
    await sleep(500);
    busyHosts.delete(host);
  }
}));

const broken = [...results].filter(([, r]) => r.state === 'broken');
const blocked = [...results].filter(([, r]) => r.state === 'blocked');
// Moved to a different site or page (ignoring www, trailing slashes and http→https)
const norm = u => { const x = new URL(u); return x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); };
const moved = [...results].filter(([u, r]) => r.state === 'ok' && r.final && norm(r.final) !== norm(u));

// Deadlines: confirmed dates that have passed, and usual months coming up that need this year's date
const thisMonth = Number(today.slice(5, 7));
const nextMonth = thisMonth % 12 + 1;
const passed = catalog.items.filter(i => i.deadline && days(i.deadline) < 0);
const soonUnconfirmed = catalog.items.filter(i => !i.deadline && [thisMonth, nextMonth].includes(i.dueMonth));
const stale = days(catalog.checked) < -120;

const lines = [`# Catalog check, ${today}`, '',
  `${results.size} links checked: ${results.size - broken.length - blocked.length} ok, ${broken.length} broken, ${blocked.length} blocked bots (fine).`, ''];
const section = (title, rows) => { if (rows.length) lines.push(`## ${title}`, '', ...rows, ''); };
section('Broken links (fix or remove)', broken.map(([u, r]) => `- [ ] ${u} → **${r.status}**  \n  used by ${links.get(u).join('; ')}`));
section('Moved (update the link if the new page is right)', moved.map(([u, r]) => `- [ ] ${u} → ${r.final}  \n  used by ${links.get(u).join('; ')}`));
section('Confirmed deadline has passed (find next year\'s date, or switch to dueMonth)', passed.map(i => `- [ ] **${i.name}**: ${i.deadline} · ${i.url}`));
section(`Usually due in ${MONTHS[thisMonth - 1]} or ${MONTHS[nextMonth - 1]} (confirm this year's date and set deadline + verified)`, soonUnconfirmed.map(i => `- [ ] **${i.name}**: usually ${MONTHS[i.dueMonth - 1]} · ${i.url}`));
if (stale) lines.push(`> catalog.json "checked" is ${catalog.checked}, over 4 months old. Update it after a full review.`, '');
section('Blocked bots (open these by hand now and then)', blocked.map(([u, r]) => `- ${u} (${r.status})`));

const report = lines.join('\n');
console.log(report);
if (process.argv[2]) writeFileSync(process.argv[2], report);
process.exitCode = broken.length || moved.length || passed.length || soonUnconfirmed.length || stale ? 1 : 0;
