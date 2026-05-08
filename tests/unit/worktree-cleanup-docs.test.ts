import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Git worktree cleanup runbook', () => {
  it('documents the safe post-merge cleanup path for feature worktrees', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs', 'runbooks', 'git-worktree-cleanup.md'),
      'utf8',
    )

    expect(doc).toContain('gh pr merge')
    expect(doc).toContain('git worktree list --porcelain')
    expect(doc).toContain('git -C <feature-worktree> status --short')
    expect(doc).toContain('git worktree remove <feature-worktree>')
    expect(doc).toContain('git branch --delete <feature-branch>')
    expect(doc).toContain('Do not check out main inside a feature worktree')
  })
})
