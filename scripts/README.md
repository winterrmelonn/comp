# Catalog maintenance scripts

Keeping Discover accurate matters more than making it big, so new and changed entries always go through a person. No paid APIs are used.

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

## Adding and correcting entries

Reviewers add new opportunities or fix existing ones on the site: **Review events → Discover entries → + Add an opportunity**. Fill in the official link, deadline (or usual month), award and summary, then approve. Approved entries appear on Discover right away (stored in `catalog_drafts`, supabase-10.sql), on top of `data/catalog.json`. Tick "confirmed" only when this year's deadline is on the official page.

When the weekly check flags something, open the page, then fix it either in the review page or in `data/catalog.json` (run `node test.js` before committing).

## Why not import a big scholarship database?

The big aggregators (Fastweb, Scholarships.com, Bold.org, Niche) don't allow scraping or republishing, and their data is often stale. CareerOneStop's Scholarship Finder runs on a licensed commercial database and isn't offered through its API or bulk downloads (checked Oct 2026). Hand-checked entries from official pages, plus events submitted through Submit an event, are the legal way to grow the catalog.
