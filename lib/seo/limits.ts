/**
 * SEO length constraints. Mirrored from the Ahrefs site audit's "Content" checks
 * (title-too-long, meta-too-short, meta-too-long). Tested in
 * `tests/unit/seo-metadata-limits.test.ts` which walks every page.tsx metadata
 * export and asserts these limits — keep them in sync with that test.
 */

export const TITLE_MAX = 60
export const DESCRIPTION_MIN = 70
export const DESCRIPTION_MAX = 160

export function isWithinTitleLimit(title: string): boolean {
  return title.length > 0 && title.length <= TITLE_MAX
}

export function isWithinDescriptionLimits(description: string): boolean {
  return description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_MAX
}
