# Evidence Ledger Homepage And SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Evidence Ledger homepage, five SEO routes, metadata, schema, sitemap, robots, upload processing polish, and verification coverage.

**Architecture:** Keep public product education data in focused shared modules under `lib/seo` and render with reusable public route components under `components/marketing`. Keep the authenticated upload flow in `app/(dashboard)/app/page.tsx` and add a small processing animation component there. Use Next.js App Router metadata exports, `app/sitemap.ts`, and `app/robots.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Vitest, Playwright, OKLCH CSS tokens, Montserrat-first font stack with Geist fallback.

---

## File Map

- Create `lib/seo/site.ts`: site URL, public route constants, metadata builder, JSON-LD builders.
- Create `lib/seo/conversion-pages.ts`: page data for homepage links and five SEO routes.
- Create `components/marketing/json-ld.tsx`: safe JSON-LD script component.
- Create `components/marketing/conversion-page.tsx`: reusable Evidence Ledger route shell.
- Create `app/bank-statement-converter/page.tsx`.
- Create `app/bank-statement-to-excel/page.tsx`.
- Create `app/bank-statement-to-csv/page.tsx`.
- Create `app/convert-scanned-bank-statements/page.tsx`.
- Create `app/faq/bank-statement-conversion/page.tsx`.
- Create `app/sitemap.ts`.
- Create `app/robots.ts`.
- Modify `app/layout.tsx`: Montserrat-first font stack, stronger global metadata.
- Modify `app/globals.css`: Montserrat stack token, processing animation classes, reduced motion.
- Modify `app/page.tsx`: Evidence Ledger homepage with metadata and JSON-LD.
- Modify `app/(dashboard)/app/page.tsx`: processing animation and provider-neutral copy.
- Add `tests/unit/seo-pages.test.tsx`.
- Add `tests/unit/seo-metadata.test.ts`.
- Add `tests/unit/sitemap.test.ts`.
- Add `tests/unit/robots.test.ts`.
- Add `tests/e2e/seo.spec.ts`.

## Tasks

### Task 1: Shared SEO Data And Metadata

**Files:**

- Create: `lib/seo/site.ts`
- Create: `lib/seo/conversion-pages.ts`
- Create: `components/marketing/json-ld.tsx`
- Test: `tests/unit/seo-metadata.test.ts`

- [ ] **Step 1: Write metadata tests**

```ts
import { describe, expect, it } from 'vitest'
import { buildPageMetadata, buildSoftwareApplicationJsonLd } from '@/lib/seo/site'

describe('SEO metadata helpers', () => {
  it('builds canonical, Open Graph, and Twitter metadata for a public page', () => {
    const metadata = buildPageMetadata({
      title: 'Bank Statement Converter to Excel | PrizmView',
      description:
        'Convert PDF bank statements into clean Excel or CSV files with secure processing and review.',
      path: '/bank-statement-converter',
    })

    expect(metadata.alternates?.canonical).toBe('/bank-statement-converter')
    expect(metadata.openGraph?.url).toBe('https://prizmview.app/bank-statement-converter')
    expect(metadata.twitter?.card).toBe('summary_large_image')
  })

  it('builds SoftwareApplication schema without unsupported claims', () => {
    const schema = buildSoftwareApplicationJsonLd()
    expect(schema['@type']).toBe('SoftwareApplication')
    expect(JSON.stringify(schema)).not.toMatch(
      /SOC 2 compliant|100% accuracy|bank-level encryption/i,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/seo-metadata.test.ts`
Expected: fail because `lib/seo/site.ts` does not exist.

- [ ] **Step 3: Implement metadata and schema helpers**

Create helper functions with exact route URLs, canonical paths, Open Graph and Twitter metadata, Organization schema, SoftwareApplication schema, BreadcrumbList schema, and FAQPage schema.

- [ ] **Step 4: Run focused test**

Run: `pnpm exec vitest run tests/unit/seo-metadata.test.ts`
Expected: pass.

### Task 2: Homepage And SEO Page Rendering

**Files:**

- Modify: `app/page.tsx`
- Create: `components/marketing/conversion-page.tsx`
- Create five route `page.tsx` files under `app/`
- Test: `tests/unit/seo-pages.test.tsx`

- [ ] **Step 1: Write page rendering tests**

Assert the homepage H1 is `Convert Bank Statements to Excel, CSV, or Google Sheets`, each SEO route has one unique H1, each page links to related SEO routes, and FAQ content renders concise answers.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/seo-pages.test.tsx`
Expected: fail because routes and new heading do not exist yet.

- [ ] **Step 3: Implement homepage and reusable SEO page shell**

Use flat evidence sections, definition lists, tables, badges, internal links, and no unsupported claims.

- [ ] **Step 4: Run focused test**

Run: `pnpm exec vitest run tests/unit/seo-pages.test.tsx`
Expected: pass.

### Task 3: Sitemap And Robots

**Files:**

- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Test: `tests/unit/sitemap.test.ts`
- Test: `tests/unit/robots.test.ts`

- [ ] **Step 1: Write sitemap and robots tests**

Assert sitemap includes homepage, five SEO routes, trust routes, docs routes, and excludes `/app`, `/ops`, `/api`, `/auth/callback`, `/login`, and `/register`. Assert robots disallow private routes and references `/sitemap.xml`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/sitemap.test.ts tests/unit/robots.test.ts`
Expected: fail because sitemap and robots modules do not exist.

- [ ] **Step 3: Implement sitemap and robots routes**

Use App Router metadata route types from `next`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec vitest run tests/unit/sitemap.test.ts tests/unit/robots.test.ts`
Expected: pass.

### Task 4: Montserrat Stack And Upload Processing Polish

**Files:**

- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/(dashboard)/app/page.tsx`
- Test: `tests/unit/upload-page.test.tsx`

- [ ] **Step 1: Extend upload tests**

Assert processing states expose Reading document, Detecting transactions, Checking balances, and Preparing export, and that provider-neutral extraction copy appears in the upload flow.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/upload-page.test.tsx`
Expected: fail before the processing animation copy exists.

- [ ] **Step 3: Implement Montserrat-first CSS and processing animation**

Load Montserrat through `next/font/google` in `app/layout.tsx` and declare `--font-product: var(--font-montserrat), var(--font-geist-sans), Arial, Helvetica, sans-serif`. Add a lightweight document-to-table animation using transform and opacity plus reduced-motion fallback. Replace generic OCR wording with extraction wording except evidence-specific IDs.

- [ ] **Step 4: Run focused test**

Run: `pnpm exec vitest run tests/unit/upload-page.test.tsx`
Expected: pass.

### Task 5: E2E And Full Verification

**Files:**

- Create: `tests/e2e/seo.spec.ts`

- [ ] **Step 1: Add Playwright SEO smoke coverage**

Verify public SEO routes resolve, H1s render, JSON-LD scripts parse, `/sitemap.xml` resolves, and `/robots.txt` resolves.

- [ ] **Step 2: Run broad checks**

Run:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run tests/unit/seo-metadata.test.ts tests/unit/seo-pages.test.tsx tests/unit/sitemap.test.ts tests/unit/robots.test.ts tests/unit/upload-page.test.tsx
pnpm test
pnpm build
```

Expected: all pass.

- [ ] **Step 3: Browser verify**

Start `pnpm dev` on an available port and check homepage, all five SEO routes, sitemap, robots, and upload surface on mobile and desktop. Capture defects, patch them, and rerun focused checks.
