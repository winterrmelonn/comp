# Catalog maintenance scripts

Keeping Discover accurate matters more than making it big, so new and changed data always goes through a person.

## Weekly link and deadline check (`check-catalog.mjs`)

Runs every Monday through `.github/workflows/catalog-check.yml`, or by hand:

```sh
node scripts/check-catalog.mjs report.md
```

It checks every link in `data/catalog.json` and `data/study.json` and reports:

- **Broken** links (404, 5xx, DNS errors, timeouts).
- **Moved** pages (redirected to a different site or path).
- **Passed deadlines** on entries marked as confirmed.
- **Due soon but unconfirmed:** entries usually due this month or next whose date for this year still needs checking.
- **Blocked bots** (403/429): fine, but worth opening by hand now and then.

When anything needs attention, the GitHub Action opens (or updates) an issue labeled `catalog-check`. No API key is needed.

## AI-assisted extraction (`extract-opportunity.mjs`)

Reads an official page and drafts a catalog entry with Claude. Each draft includes exact quotes as evidence, a confidence level, and concerns for the reviewer. It never edits the catalog: drafts go to `data/candidates.json`.

```sh
cd scripts && npm install
export ANTHROPIC_API_KEY=...            # or `ant auth login`
node extract-opportunity.mjs https://example.org/scholarship   # new entries
node extract-opportunity.mjs --due-soon                         # re-read entries due this month or next
```

To review: open each draft's `url`, check the `evidence` quotes against the page, fix anything wrong, then copy approved entries into `data/catalog.json`. Set `verified: true` only when the deadline is confirmed for this year, and update `checked`. Run `node test.js` before committing.

## Why not import a big scholarship database?

The big aggregators (Fastweb, Scholarships.com, Bold.org, Niche) don't allow scraping or republishing, and their data is often stale. CareerOneStop's Scholarship Finder runs on a licensed commercial database and isn't offered through its API or bulk downloads (checked Oct 2026). Official pages, read with AI and approved by a person, plus events submitted through Submit an event, are the legal way to grow the catalog.
