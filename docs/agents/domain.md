# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

PRIZM is configured as a single-context repo.

- Read root `CONTEXT.md` when it exists.
- Read relevant root ADRs under `docs/adr/`.
- If `CONTEXT.md` does not exist, proceed silently.

The producer skill creates `CONTEXT.md` lazily when domain language is resolved.

## Before exploring

Read the files that match the task:

- `CONTEXT.md` for domain vocabulary and project language.
- `docs/adr/` for architectural decisions that touch the area under change.
- `README.md` and `CLAUDE.md` for repo bring-up and operational conventions.

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`.

If the concept is missing from the glossary, either reconsider the term or note the gap for the documentation producer workflow.

## Flag ADR conflicts

If output contradicts an existing ADR, surface that conflict explicitly rather than silently overriding the decision.
