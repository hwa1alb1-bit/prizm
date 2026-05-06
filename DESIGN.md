---
name: PRIZM
description: Evidence-led bank statement conversion for accounting teams.
colors:
  background: 'oklch(98.7% 0.006 185)'
  foreground: 'oklch(19% 0.018 185)'
  surface-muted: 'oklch(96% 0.008 185)'
  surface-strong: 'oklch(92% 0.01 185)'
  border-subtle: 'oklch(84% 0.012 185)'
  accent: 'oklch(52% 0.11 185)'
  accent-foreground: 'oklch(98% 0.006 185)'
  success: 'oklch(45% 0.12 150)'
  warning: 'oklch(57% 0.13 78)'
  danger: 'oklch(54% 0.16 28)'
  info: 'oklch(49% 0.1 230)'
typography:
  headline:
    fontFamily: 'Geist, Geist Fallback, Arial, Helvetica, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0'
  title:
    fontFamily: 'Geist, Geist Fallback, Arial, Helvetica, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: '0'
  body:
    fontFamily: 'Geist, Geist Fallback, Arial, Helvetica, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: '0'
  label:
    fontFamily: 'Geist, Geist Fallback, Arial, Helvetica, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: '0.08em'
rounded:
  sm: '6px'
  md: '8px'
  full: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-foreground}'
    rounded: '{rounded.sm}'
    padding: '0 16px'
    height: '44px'
  button-secondary:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.sm}'
    padding: '0 16px'
    height: '44px'
  badge-state:
    backgroundColor: '{colors.surface-strong}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.full}'
    padding: '0 10px'
    height: '28px'
  evidence-panel:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '20px'
---

# Design System: PRIZM

## 1. Overview

**Creative North Star: "The Evidence Ledger"**

PRIZM is a calm product interface for financial operators who need to see what happened, when it happened, and whether it is safe to act. The visual system is restrained by design: pale teal-tinted neutrals, a single operational accent, compact tables, and direct labels that make status and evidence inspectable.

The system should feel precise and controlled, closer to a firm workflow ledger than a marketing dashboard. Density is allowed when it helps review work. Decorative confidence is forbidden; every trust claim must be paired with a visible artifact such as a state badge, timestamp, request ID, trace ID, receipt, or audit event.

**Key Characteristics:**

- Restrained, evidence-first product UI with no ornamental trust language.
- Light by default for accounting work in ordinary office conditions, with dark-mode tokens available through the same roles.
- Tables, definition lists, and bordered sections carry most evidence surfaces.
- Accent color is rare and functional: primary actions, links, focus rings, and active evidence.

## 2. Colors

The palette is a cool, low-chroma teal system that makes financial evidence feel clinical without becoming cold.

### Primary

- **Audit Teal** (`accent`): Used for primary actions, links, focus rings, and the smallest set of active states. It should stay under 10% of any product screen.

### Secondary

- **Verification Green** (`success`): Used only for ready, reconciled, sent, and passing evidence states.
- **Processing Blue** (`info`): Used for in-flight states such as processing, trace context, and non-blocking status.

### Tertiary

- **Retention Amber** (`warning`): Used for expiration and receipt-watch states.
- **Failure Vermilion** (`danger`): Used for failed uploads, failed receipts, and unrecoverable document states.

### Neutral

- **Ledger Paper** (`background`): The main app canvas.
- **Muted Ledger Surface** (`surface-muted`): Sidebars, empty states, and quiet panels.
- **Strong Ledger Surface** (`surface-strong`): Neutral badges and low-emphasis controls.
- **Fine Rule** (`border-subtle`): Section dividers, table rules, and control borders.
- **Ink** (`foreground`): Body text, labels, and data.

### Named Rules

**The Evidence Color Rule.** Color never carries meaning alone. Every status color must be paired with text such as Pending, Ready, Failed, Expired, Receipt sent, or Trace.

**The Rare Accent Rule.** Audit Teal is functional, never decorative. Do not use it as a hero wash, background flourish, gradient, or large brand field.

## 3. Typography

**Display Font:** Geist, Geist Fallback, Arial, Helvetica, sans-serif
**Body Font:** Geist, Geist Fallback, Arial, Helvetica, sans-serif
**Label/Mono Font:** Geist Mono is available through `--font-geist-mono`; use it for IDs only when fixed-width scanning is useful.

**Character:** The type system is compact, steady, and native-feeling. It should support repeated review work rather than call attention to itself.

### Hierarchy

- **Headline** (600, `1.875rem`, `1.2`): Route titles such as Review and evidence or document filenames.
- **Title** (600, `1.125rem`, `1.35`): Section headings inside evidence panels and review blocks.
- **Body** (400, `0.875rem`, `1.7`): Explanatory copy, table cells, and definition-list values. Cap prose at 65-75ch.
- **Label** (600, `0.75rem`, `0.08em`, uppercase when used as an eyebrow): Table headers, section eyebrows, and trust-control labels.

### Named Rules

**The Operator Text Rule.** Do not use display fonts, novelty weights, or oversized type inside the app shell. PRIZM is a working tool.

**The Numeric Scan Rule.** Keep tabular numbers enabled. Dates, balances, counts, and IDs need to align visually during review.

## 4. Elevation

PRIZM uses tonal layering and borders instead of shadows. Depth comes from surface changes, fine rules, section spacing, and table dividers. Components are flat at rest so the data remains the visual priority.

### Named Rules

**The Flat Evidence Rule.** Use borders and background roles before shadows. Shadows are reserved for future overlays or menus, not default panels.

**The No Floating Card Rule.** Page sections are not decorative cards. Use bordered evidence sections, tables, and definition lists; avoid nested cards.

## 5. Components

### Buttons

- **Shape:** Gently squared controls (`6px` radius), minimum height `44px`.
- **Primary:** Audit Teal background with Accent Foreground text, semibold label, `16px` horizontal padding.
- **Hover / Focus:** Hover uses opacity or muted surface changes. Focus uses a 2px Audit Teal ring.
- **Secondary:** Border-only button on the page background or muted panel, same radius and height as primary.

### Chips

- **Style:** Rounded-full state badges (`999px`) with tinted backgrounds using the matching state token.
- **State:** Pending is neutral, Processing is info, Ready is success, Failed is danger, Expired is warning. Always include the text label.

### Cards / Containers

- **Corner Style:** `8px` radius for evidence sections and table frames.
- **Background:** Main panels use Ledger Paper; empty states and sidebars use Muted Ledger Surface.
- **Shadow Strategy:** No default shadows.
- **Border:** Fine Rule border on tables, panels, sidebars, and controls.
- **Internal Padding:** `16px` for compact panels, `20px` for evidence sections, `24px` for empty states.

### Inputs / Fields

- **Style:** Bordered, `6px` radius controls on the page background.
- **Focus:** 2px Audit Teal focus ring, never color-only validation.
- **Error / Disabled:** Disabled uses reduced opacity and cursor state. Error uses Failure Vermilion text plus a visible message.

### Navigation

- **Style:** Desktop uses a fixed left sidebar on Muted Ledger Surface with compact links. Mobile uses a top header with horizontally scrollable nav buttons.
- **States:** Hover changes the background to Ledger Paper or Muted Ledger Surface. Active states should use the same link vocabulary as other app routes.

### Evidence Tables

- **Style:** Tables use compact text, uppercase labels, Fine Rule dividers, and horizontal overflow for dense financial evidence.
- **Behavior:** Long IDs and S3 keys must wrap or break cleanly. Evidence cells should prefer exact values over explanatory prose.

## 6. Do's and Don'ts

### Do:

- **Do** pair every trust claim with an implementation artifact: state, receipt, timestamp, request ID, trace ID, retention deadline, or audit event.
- **Do** use the five persisted document labels exactly: Pending, Processing, Ready, Failed, Expired.
- **Do** keep PRIZM dense and scannable. Tables and definition lists are the default evidence surfaces.
- **Do** keep Accent usage rare and functional.
- **Do** preserve workspace and audit language in the UI whenever data crosses a sensitive boundary.

### Don't:

- **Don't** use generic SaaS gloss, vague trust copy, decorative security badges, gradient theater, or claims that sound confident without showing evidence.
- **Don't** use consumer fintech flash, neon dashboards, gamified money visuals, crypto-adjacent styling, or unserious animation.
- **Don't** bury compliance in policy-only copy while the workflow stays opaque.
- **Don't** use side-stripe borders, gradient text, glassmorphism, hero metrics, or identical decorative card grids.
- **Don't** communicate status by color alone.
