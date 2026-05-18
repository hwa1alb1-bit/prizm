# Evidence Ledger Homepage And SEO Design

## Summary

Build the next PRIZM public product surface in the Evidence Ledger lane. The homepage should make bank statement conversion obvious in the first viewport, connect directly to the authenticated upload flow, and show proof through visible evidence surfaces rather than broad trust claims.

The work also adds five focused SEO routes for high-intent bank statement conversion searches, plus sitemap, robots, metadata, and JSON-LD support. These pages are conversion-focused product education, not generic marketing pages.

## Current Context

PRIZM is a Next.js 16 App Router application using React 19, Tailwind 4, TypeScript, Geist, and OKLCH CSS tokens. The existing homepage lives at `app/page.tsx`. The authenticated upload workflow lives at `app/(dashboard)/app/page.tsx` and already covers idle, hashing, preflight, confirmation, presign, upload, completion, conversion, polling, done, and error states.

`PRODUCT.md` defines PRIZM as a lean bank statement converter for accountants, bookkeepers, and small-firm owners. `DESIGN.md` defines the Evidence Ledger north star: restrained teal-tinted neutrals, rare Audit Teal accent, flat borders, tables, definition lists, badges, timestamps, IDs, receipts, and no unsupported claims.

## Design Direction

Color strategy is Restrained. Audit Teal remains functional only: primary actions, links, focus rings, and active evidence. The interface stays light by default because the primary scene is an accountant or bookkeeper reviewing statement rows at a desk during ordinary office work, trying to finish clean exports quickly.

Typography should use Montserrat first, loaded through `next/font/google`, with Geist and system sans fallbacks. Keep letter spacing at 0 outside short uppercase labels.

The page should feel like a conversion workbench. Use table previews, definition lists, evidence rows, and state badges. Avoid hero metrics, decorative cards, gradient text, side-stripe accents, gloss, security badges, and claims that are not backed by current routes or implementation evidence.

## Homepage Shape

The homepage first viewport should answer four questions quickly:

- What does it do: convert bank statements into Excel, CSV, or Google Sheets ready data.
- Who is it for: accountants, businesses, lenders, investigators, and finance teams.
- Why should it be trusted: review before export, 24-hour retention, request evidence, audit-friendly states, visible limitations.
- What should the user do next: start conversion or review security and privacy evidence.

The primary visual should be a compact document-to-spreadsheet surface with a table preview, export controls, and evidence facts. The next fold should show the workflow as Upload, Extract, Review, Export, then support details such as file formats, output formats, limitations, trust links, and FAQ preview.

## Upload Workflow Polish

Keep the current upload state machine. Improve the visible processing state by adding a lightweight animation that shows statement rows resolving into spreadsheet columns. Use transform and opacity only, and include `prefers-reduced-motion` fallbacks.

Prefer provider-neutral extraction language on user-facing surfaces. Provider-specific identifiers such as Textract job IDs can remain when they are actual evidence values.

## SEO Route Strategy

Create five routes:

- `/bank-statement-converter`
- `/bank-statement-to-excel`
- `/bank-statement-to-csv`
- `/convert-scanned-bank-statements`
- `/faq/bank-statement-conversion`

Each route needs unique title, H1, meta description, body copy, internal links, and a page-specific content angle. The scanned statements page must set honest expectations and avoid claiming OCR support beyond what the product can verify. The FAQ route should include concise answers and FAQ JSON-LD.

## Technical SEO

Add a shared metadata and schema helper so page titles, descriptions, canonicals, Open Graph, Twitter metadata, breadcrumbs, organization schema, software application schema, and FAQ schema stay consistent.

Add `app/sitemap.ts` and `app/robots.ts`. The sitemap should include the homepage, SEO routes, and public trust/legal/docs pages. Robots should allow public routes while disallowing authenticated app routes, ops routes, API routes, and auth callback routes.

## Tests And Verification

Add or update tests for:

- Homepage heading, conversion workflow, evidence copy, and internal links.
- Five SEO routes with unique H1s and useful route-specific content.
- Metadata helper output, canonical URLs, Open Graph, Twitter metadata, and JSON-LD shape.
- Sitemap inclusion and private route exclusions.
- Robots allow and disallow policy.
- Upload processing animation content and reduced-motion-safe structure where practical.

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, focused Vitest tests, `pnpm test`, `pnpm build`, and browser checks for desktop and mobile public pages.

## Open Items

Montserrat is the approved font direction. No separate licensed font asset is needed because the project can load it through Next.js font handling.
