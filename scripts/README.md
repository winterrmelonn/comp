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

**With the review page (recommended):** set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` too, and drafts go to the `catalog_drafts` table (supabase-10.sql) instead of a file. Reviewers open **Review events → Catalog drafts**, check the quoted evidence against the official page, fix any field, tick "confirmed" only if this year's deadline is on the page, and approve. Approved entries appear on Discover right away, with no commit needed. An approved update replaces the matching `data/catalog.json` entry.

**Without Supabase:** drafts go to `data/candidates.json`. Copy approved ones into `data/catalog.json` by hand, and run `node test.js` before committing.

**Monthly, automatically:** `.github/workflows/catalog-drafts.yml` runs `--due-soon` on the 1st of each month. You can also run it from the Actions tab with a list of URLs. It does nothing until the repo has the `ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets. The service role key bypasses row-level security, so keep it in GitHub secrets only and never in the site's code.

## Why not import a big scholarship database?

The big aggregators (Fastweb, Scholarships.com, Bold.org, Niche) don't allow scraping or republishing, and their data is often stale. CareerOneStop's Scholarship Finder runs on a licensed commercial database and isn't offered through its API or bulk downloads (checked Oct 2026). Official pages, read with AI and approved by a person, plus events submitted through Submit an event, are the legal way to grow the catalog.
