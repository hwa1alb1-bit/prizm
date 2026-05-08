# Git Worktree Cleanup

Use this workflow after a pull request is ready to merge and its feature worktree
can be retired.

## Safe Cleanup Path

1. Merge the pull request server-side from the main worktree or GitHub:

   ```powershell
   gh pr merge <pr-number> --squash --delete-branch
   ```

2. Return to the main worktree and update it:

   ```powershell
   git switch main
   git fetch --prune origin
   git pull --ff-only origin main
   ```

3. List registered worktrees and find the merged feature worktree:

   ```powershell
   git worktree list --porcelain
   ```

4. Confirm the feature worktree is clean before removing it:

   ```powershell
   git -C <feature-worktree> status --short
   ```

   Stop if this prints any uncommitted files. Move or commit those changes before
   cleanup.

5. Remove only the clean merged worktree:

   ```powershell
   git worktree remove <feature-worktree>
   ```

6. Delete the local feature branch after the worktree is gone:

   ```powershell
   git branch --delete <feature-branch>
   ```

## Guardrails

- Do not check out main inside a feature worktree. Keep `main` in the main
  worktree and retire feature worktrees from there.
- Do not use `git worktree remove --force` unless the worktree contents were
  already reviewed and intentionally discarded.
- Do not delete a local branch before its worktree has been removed.
- If `git branch --delete <feature-branch>` says the branch is not merged, stop
  and inspect the branch with `git log --oneline --decorate main..<feature-branch>`.
