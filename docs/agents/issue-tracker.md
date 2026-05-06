# Issue tracker: GitHub

Issues and PRDs for this repo live in GitHub Issues for `hwa1alb1-bit/prizm`.

Use the `gh` CLI for issue operations from inside this clone. The CLI infers the repository from `git remote -v`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply a label**: `gh issue edit <number> --add-label "..."`
- **Remove a label**: `gh issue edit <number> --remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Use a temporary body file for multi-line issue bodies when that is clearer than shell quoting.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `hwa1alb1-bit/prizm`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` from the repo root.
