import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Supabase migration order', () => {
  it('uses unique numeric prefixes so fresh databases apply migrations deterministically', () => {
    const migrationNames = readdirSync(resolve(process.cwd(), 'supabase/migrations')).filter(
      (name) => name.endsWith('.sql'),
    )
    const prefixes = migrationNames.map((name) => name.split('_')[0])
    const duplicates = prefixes.filter((prefix, index) => prefixes.indexOf(prefix) !== index)

    expect(duplicates).toEqual([])
  })
})
