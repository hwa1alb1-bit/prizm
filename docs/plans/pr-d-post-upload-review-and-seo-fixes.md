# PR-D — Planning docs + 5 PRIZM fixes

## Context

`main` is at `c588204` (PRs #123–#126 are post-#122 deploy/benchmark fixes). One open PR exists (#106 WIP auth recovery), unrelated.

This branch ships as a single PR-D bundling the planning doc that frames it plus five user-facing fixes that fell out of a real upload session and follow-up audits:

1. The "Mark reviewed" action on Editable Review does nothing visible on the evidence timeline — it should advance the document to **Export ready**.
2. Two adjacent timeline events ("Extraction completed" / "Statement extracted") read as redundant.
3. The Editable Review and Transaction Table panels are always-open and dominate the review page — they should be collapsible.
4. Cloudflare scanner is flagging five security items on `pdftoexcelstatementconverter.com`.
5. Ahrefs site audit returned 18 distinct issue types across the site.

Decisions already locked with the user:

- Issue #2 → **merge** the two events into a single user-facing "Statement extracted" step (audit records preserved under the hood).
- Issue #5 → user provided Ahrefs screenshot; ship code fixes in PR-D for everything actionable in-app.

Branch naming: `feat/post-upload-review-and-seo-fixes` off latest `main`.

---

## Issue #1 — "Mark reviewed" advances timeline to Export ready

**Where it lives today**

- Button: `components/app/editable-review-workflow.tsx:358-366` (`Mark reviewed`, calls `save(true)`).
- API: `PATCH /api/v1/documents/{id}/statement` at `app/api/v1/documents/[documentId]/statement/route.ts` with `reviewed: true`.
- Persistence: `lib/server/statement-edit.ts:329-334` records an audit event with `eventType: 'statement.reviewed'`.
- Timeline step: `components/app/document-history.tsx:715-735` — `export_generated` only flips to `complete` when an `exportGeneratedAudit` event exists; ignores `statement.reviewed`.

**Fix**

- In the document fetcher that produces `document.auditEvents` (whichever currently sources `exportGeneratedAudit`), also surface the latest `statement.reviewed` event as `statementReviewedAudit`.
- In `document-history.tsx:715-735`, update the `export_generated` status branch: if `exportGeneratedAudit` OR `statementReviewedAudit` exists → `complete`. Adjust the `detail` copy:
  - downloaded: keep "Your export is ready for download."
  - reviewed-only: "Statement reviewed — ready to export."
  - waiting + ready: keep existing.
- Use the reviewed audit's `createdAt` for the step timestamp when no export event exists yet.

**Tests**

- Extend `tests/unit/document-history-components.test.tsx` to render with a `statement.reviewed` audit event and assert the `Export ready` step status is `complete`.
- Existing `tests/unit/editable-review-workflow.test.tsx` (lines 89, 143, 218) keeps verifying the button itself.

---

## Issue #2 — Merge "Extraction completed" + "Statement extracted"

**Where it lives**

- `components/app/document-history.tsx:669-714` defines the two steps `ocr_completed` (label "Extraction completed") and `statement_extracted` (label "Statement extracted").

**Fix (merge per user decision)**

- Delete the `ocr_completed` step block from the timeline.
- Keep `statement_extracted` and broaden its `status` / `detail` to absorb both signals:
  - `complete` when `statement` exists.
  - `blocked` when `recoveryKind === 'ocr_processing_failed'` OR `document.state === 'ready'` with no statement (preserve PR #114 blocked semantics).
  - `active` when `document.state === 'processing'`.
  - `detail` uses the bank name + transaction count on complete; on blocked, reuse the redacted failure reason copy from the deleted step.
- Page count evidence row (currently on `ocr_completed`) moves to `statement_extracted`.
- Audit records and DB events are **not** dropped — only the user-facing label is collapsed.

**Tests**

- `tests/unit/document-history-components.test.tsx:52–132` currently asserts both labels appear; rewrite to assert only "Statement extracted" and that page count / bank name evidence both show under it.
- `app/(dashboard)/app/history/loading.tsx:70-71` and `app/(dashboard)/app/history/[documentId]/loading.tsx:53-54` already only render "Statement extracted" + "Export ready" — no change needed.

---

## Issue #3 — Editable Review + Transaction Table as accordions

**Where it lives**

- `components/app/document-history.tsx:325-353` already defines `DisclosureSection` (native `<details>`+`<summary>`, chevron, `defaultOpen` prop). Pattern proven by the Exceptions panel at `:177-183`.
- `EditableReviewWorkflow` mounted at `components/app/document-history.tsx:161`.
- `TransactionTable` defined at `components/app/document-history.tsx:902-989`, mounted in the same `DocumentReview` body.

**Fix**

- Wrap both panels in `DisclosureSection` instead of `EvidenceSection`.
- Defaults:
  - Editable Review → `defaultOpen={!statementReviewedAudit}` (collapses once reviewed).
  - Transaction Table → `defaultOpen={true}` on first render, but auto-collapses once user marks reviewed (achieved by the same `!statementReviewedAudit` rule on a fresh render after `router.refresh()`).
- No localStorage / URL-param persistence (matches existing Exceptions pattern; user already accepted that default).
- No new dep — `<details>` is native.

**Tests**

- Update `tests/unit/document-history-components.test.tsx` and `tests/unit/document-review-page.test.tsx` to expect `<details>`+`<summary>` instead of bare section for these two panels. `tests/unit/editable-review-workflow.test.tsx` is unaffected (tests the inner workflow, not the wrapper).

---

## Issue #4 — Cloudflare security flags

**Reality check on what's shippable in PR-D**

The Cloudflare MCP connector available in this session exposes only D1 / KV / R2 / Hyperdrive / Workers + docs search. It does NOT expose DNS zones, AI Crawl Control, AI Labyrinth toggles, WAF rules, or zone-level security settings. Additionally, the `pdftoexcelstatementconverter.com` zone lives on a Cloudflare account Hank does not currently have edit permission on (memory `project_prizm_cloudflare_access_blocked`, 2026-06-26).

Split the five flags accordingly:

| #   | Flag                                                | Severity | Status in PR-D                                                                          |
| --- | --------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| 1   | Review and block AI bots from accessing your assets | Moderate | **Partial in code** (robots.txt) + **deferred dashboard toggle**                        |
| 2   | Unproxied A Record detected                         | Moderate | **Deferred / likely false positive** (Vercel requires DNS-only apex `76.76.21.21`)      |
| 3   | Unproxied CNAME Record detected                     | Moderate | **Deferred / likely false positive** (`www` → `cname.vercel-dns.com` requires DNS-only) |
| 4   | Disrupt unwanted AI crawlers with AI Labyrinth      | Low      | **Deferred** (dashboard-only feature, no MCP / no zone access)                          |
| 5   | Configure your website's Security.txt               | Low      | **Shipped in code**                                                                     |

**Shippable in PR-D**

- **Add `app/.well-known/security.txt/route.ts`** returning RFC 9116 compliant body:
  ```
  Contact: mailto:security@pdftoexcelstatementconverter.com
  Expires: 2027-06-30T00:00:00.000Z
  Preferred-Languages: en
  Canonical: https://pdftoexcelstatementconverter.com/.well-known/security.txt
  Policy: https://pdftoexcelstatementconverter.com/security
  ```
  Use a Next.js route handler that returns `Content-Type: text/plain`. Pair with a tiny route at `app/.well-known/security.txt.sig/route.ts` returning 404 (browsers may probe for a PGP signature).
- **Confirm `security@` inbox exists** before merge (Resend or a forwarder); if not, swap to `oneoddbob@gmail.com` for now.
- **Update `public/robots.txt`** (or `app/robots.ts` if route-based) to add `Disallow: /` blocks for: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `PerplexityBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`, `Bytespider`, `FacebookBot`, `Meta-ExternalAgent`, `ImagesiftBot`, `Diffbot`, `Omgilibot`. Keep existing user-agents (Googlebot, Bingbot) allowed.

**Deferred to a follow-up task** (track in PR description, not blocking)

- Get Cloudflare account access for the zone (separate ops thread). Once unblocked:
  - Enable AI Crawl Control → block AI bots (flag #1 fully resolved).
  - Enable AI Labyrinth (flag #4 resolved).
  - Document why apex A + www CNAME stay DNS-only (Vercel constraint) and dismiss flags #2 + #3 in the Cloudflare scanner.

---

## Issue #5 — Ahrefs 18 issue types

Ahrefs MCP returned `"Insufficient plan"` on every call — API key wired into the connector lacks Site Audit entitlement. User provided a screenshot of the issue list, classified below.

| #   | Issue                                                             | Count | Class                                                                                                      | Fix in PR-D                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Orphan page (no incoming internal links)                          | 1     | Code                                                                                                       | Identify via Ahrefs URL drilldown; add an internal link from a relevant hub (likely a `/bank/[slug]` orphan — add to footer or `/issuers` index).                                              |
| 2   | Page has only one dofollow incoming internal link (indexable)     | 12    | Code                                                                                                       | Cross-link `/bank/[slug]` ↔ `/convert/[slug]` ↔ `/integrate/[slug]` via a "Related" rail on each programmatic page.                                                                            |
| 3   | Page has only one dofollow incoming internal link (not-indexable) | 16    | Likely safe to ignore (auth / utility routes); confirm via URL list.                                       |
| 4   | Page has no outgoing links                                        | 6     | Code                                                                                                       | Add at least one footer or contextual link to thin utility pages.                                                                                                                              |
| 5   | Page has links to redirect                                        | 2     | Code                                                                                                       | Replace internal links pointing at redirect targets with the final URL.                                                                                                                        |
| 6   | 3XX redirect                                                      | 4     | Likely intentional (trailing-slash, http→https); verify and either keep or fix in `next.config` redirects. |
| 7   | HTTP to HTTPS redirect                                            | 2     | Safe (handled at edge); ignore.                                                                            |
| 8   | Meta description too long (indexable)                             | 12    | Code                                                                                                       | Trim descriptions in `app/**/page.tsx` `metadata.description` to ≤160 chars.                                                                                                                   |
| 9   | Title too long (indexable)                                        | 1     | Code                                                                                                       | Trim title in the offending page metadata to ≤60 chars.                                                                                                                                        |
| 10  | Meta description too short                                        | 18    | Code                                                                                                       | Expand short descriptions to 120–160 chars where they exist.                                                                                                                                   |
| 11  | Title too long (not-indexable)                                    | 11    | Code                                                                                                       | Same trim rule on utility-page titles.                                                                                                                                                         |
| 12  | Low word count                                                    | 10    | Content + Code                                                                                             | Add body copy to thin pages (likely some `/integrate/*` or `/convert/*` slugs) — 300+ words minimum.                                                                                           |
| 13  | Meta description too long (not-indexable)                         | 1     | Code                                                                                                       | Trim.                                                                                                                                                                                          |
| 14  | Open Graph tags incomplete                                        | 32    | Code                                                                                                       | Add `openGraph` block (title, description, url, type, images) to every page-level `metadata` export. Centralize defaults in `app/layout.tsx`.                                                  |
| 15  | Missing alt text                                                  | 42    | Code                                                                                                       | Audit every `next/image` + `<img>` usage; add `alt=""` for decorative and meaningful `alt` for content images. Largest violator is likely `public/marketing/icons/` PNGs rendered without alt. |
| 16  | Non-canonical page in sitemap                                     | 8     | Code                                                                                                       | Either remove non-canonical URLs from `app/sitemap.ts` or set the `canonical` meta on the offending pages to the in-sitemap URL. Likely the trailing-slash / case variants.                    |
| 17  | Pages to submit to IndexNow                                       | 32    | Config                                                                                                     | Add `public/<indexnow-key>.txt` + integrate IndexNow ping in the deploy workflow. (Bing/Yandex compatible, free.)                                                                              |
| 18  | Structured data has Google rich results validation error          | 24    | Code                                                                                                       | Fix JSON-LD on `app/layout.tsx` / `app/page.tsx` / per-route schemas. Most likely the `Organization` or `Product` blocks; re-validate via Google Rich Results Test.                            |

Approach: tackle in commit-sized waves so the PR stays reviewable.

**Wave A — Metadata sweep (issues #8, #9, #10, #11, #13)**
Audit every `export const metadata` and `generateMetadata` in `app/**/page.tsx`. Add a `lib/marketing/seo-limits.ts` const with `TITLE_MAX = 60`, `DESCRIPTION_MIN = 120`, `DESCRIPTION_MAX = 160`. Add a vitest that walks the metadata exports and asserts limits.

**Wave B — OpenGraph completion (issue #14)**
Default `openGraph` block in `app/layout.tsx` `metadata` with site name, default OG image (`public/marketing/og/default.png` — generate if missing), type `website`. Per-page exports override `title`, `description`, `url`.

**Wave C — Alt text sweep (issue #15)**
Grep all `<Image` and `<img` usages. Categorize decorative vs content. Empty `alt=""` for decorative icons in marketing tiles; meaningful alt for the format logos (e.g. "QuickBooks logo"). Add an ESLint rule (`jsx-a11y/alt-text`) to prevent regression.

**Wave D — Internal linking + sitemap canonicals (issues #1, #2, #4, #5, #16)**
Add a `RelatedPagesRail` component rendered on `/bank/[slug]`, `/convert/[slug]`, `/integrate/[slug]` that surfaces 3–4 sibling routes. Audit `app/sitemap.ts` against the canonical URLs emitted by `generateMetadata`. Fix redirect-link references.

**Wave E — Structured data validation (issue #18)**
Pull current JSON-LD blocks; pipe through `https://search.google.com/test/rich-results` for each affected URL; fix schema (most likely missing `image`, `priceCurrency`, or `aggregateRating` fields on a `Product` block).

**Wave F — IndexNow integration (issue #17)**
Generate a 32-char hex key, write `public/<key>.txt` with that key, add `lib/marketing/indexnow.ts` that POSTs new URLs after a successful production deploy via the existing `promote-production.yml` workflow.

**Deferred / safe to ignore for now (issues #3, #6, #7)**
Note in PR description with reasoning; revisit if any become indexable later.

---

## Files touched (representative)

- `components/app/document-history.tsx` — timeline merge + reviewed-audit wiring + accordion swap (issues 1, 2, 3)
- `components/app/editable-review-workflow.tsx` — no change to behavior; tests update only
- `lib/server/evidence/store.ts` (or wherever `auditEvents` are projected onto the `Document` type for the review page) — surface `statementReviewedAudit` (issue 1)
- `app/.well-known/security.txt/route.ts` (new) — issue 4
- `public/robots.txt` or `app/robots.ts` — AI bot disallow block (issue 4)
- `app/layout.tsx` — default OG, site verification stays (issue 5 wave B)
- `app/**/page.tsx` + `generateMetadata` exports — title/description/OG/canonical trims (issue 5 waves A, B, D)
- `app/sitemap.ts` — canonical fixes (issue 5 wave D)
- `components/marketing/related-pages-rail.tsx` (new) — internal cross-linking (issue 5 wave D)
- `lib/marketing/seo-limits.ts` (new) + vitest — regression guard (issue 5 wave A)
- `lib/marketing/indexnow.ts` (new) + `.github/workflows/promote-production.yml` patch — IndexNow ping (issue 5 wave F)
- `tests/unit/document-history-components.test.tsx`, `tests/unit/document-review-page.test.tsx` — assertion updates (issues 1, 2, 3)

---

## Verification

Run from the repo root after each wave; the full set before opening PR-D:

1. **Unit + integration** — `pnpm test` (651 vitest baseline; should land ≥670 with new SEO + timeline tests).
2. **Lint + types + format** — `pnpm verify` (per memory `feedback_prizm_pnpm_verify_before_push`; CI prettier-checks `docs/**` too).
3. **Local smoke** — start dev server, upload a real PDF, walk through:
   - Timeline shows one combined "Statement extracted" step (issue #2).
   - Editable Review + Transaction Table render as collapsible disclosures (issue #3).
   - Click "Mark reviewed" → page refresh → timeline "Export ready" flips to complete (issue #1).
4. **Static checks**
   - `curl -s https://localhost:3000/.well-known/security.txt` returns RFC 9116 body (issue #4).
   - `curl -s https://localhost:3000/robots.txt` lists all AI bot disallows (issue #4).
   - `curl -s https://localhost:3000/sitemap.xml | xmllint --noout -` is well-formed and only contains canonical URLs (issue #5 wave D).
5. **Google Rich Results Test** for two of the affected URLs once Wave E lands.
6. **Push + CI** — let GitHub Actions run; merge only after `Promote production alias` workflow successfully aliases apex + www (no manual `vercel promote` needed per PR #109 self-heal).
7. **Post-merge** — re-run Ahrefs site audit (manually from Web UI) within 7 days; confirm count drops by the waves shipped. File a follow-up for any issue that didn't resolve.

---

## Out of scope (explicit)

- Cloudflare dashboard work (zone access blocked; tracked separately).
- Ahrefs API access (the MCP key has no Site Audit entitlement; user is providing screenshots).
- Auth recovery flow (covered by open PR #106).
- Bank reconciler / BankEngine extension (tabled per `project_prizm`).
