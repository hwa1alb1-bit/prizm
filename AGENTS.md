# Repository Guidelines

## Project Structure & Module Organization

PRIZM is a Next.js 16 App Router application. App routes and pages live in `app/`, including API routes under `app/api/`. Shared UI belongs in `components/`. Server-only integrations and helpers live in `lib/server/`, while cross-runtime types and env parsing live in `lib/shared/`. Database migrations are sequential SQL files in `supabase/migrations/`. Infrastructure templates live under `infra/`, especially `infra/cloudflare/`. Tests are organized under `tests/unit`, `tests/integration`, and `tests/e2e`.

## Build, Test, and Development Commands

- `pnpm dev`: run local Next dev server on port `3030`.
- `pnpm build`: create a production Next build.
- `pnpm start`: serve the production build.
- `pnpm lint`: run ESLint.
- `pnpm format:check`: check Prettier formatting.
- `pnpm typecheck`: run `tsc --noEmit`.
- `pnpm test`: run Vitest tests.
- `pnpm test:e2e`: run Playwright E2E tests.
- `pnpm verify`: run format, lint, typecheck, and unit tests.
- `pnpm seed:stripe`: idempotently create Stripe sandbox products, prices, billing meter, and overage price.

## Coding Style & Naming Conventions

Use TypeScript, strict types, and existing local patterns. Format with Prettier and lint with ESLint. Keep server-only modules under `lib/server/` and include `import 'server-only'`. Use lazy connector singletons with `pingX()` health helpers. Name Supabase migrations with ascending numeric prefixes, for example `0005_add_missing_fk_indexes.sql`.

## Testing Guidelines

Use Vitest for unit and integration tests and Playwright for E2E coverage. Keep tests close to behavior, not implementation details. Name test files by scope, such as `tests/unit/smoke.test.ts` or `tests/e2e/smoke.spec.ts`. Run `pnpm verify` before claiming a change is complete.

## Commit & Pull Request Guidelines

Commit messages in this repo are short, imperative summaries, for example `Wire production service readiness`. Pull requests should describe user-visible impact, list verification commands run, link related issues, and include screenshots only for UI changes.

## Security & Configuration Tips

Never commit `.env.local` or secrets. Use `.env.example` for variable names only. Production uses Vercel env vars, Supabase service-role keys only on trusted server paths, and AWS access through Vercel OIDC where possible. Every server-side action touching user data should record an audit event.

## Agent-Specific Notes

Next.js 16 has breaking changes from older App Router assumptions. Before changing framework behavior, read the relevant docs in `node_modules/next/dist/docs/` and follow deprecation notices.

## Core Principles

- **Ownership mindset:** Own outcomes end-to-end. Execute fully without asking permission for every step.
- **Simplicity first:** Make every change as simple as possible. Minimal impact. No side effects. For non-trivial changes, pause to consider if there's a cleaner approach, but don't over-engineer obvious fixes.
- **No laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Proactive problem-solving:** Identify blockers, dependencies, and risks upfront. Solve or escalate, don't stall.
- **Context mastery:** The vault, repos, skills, and reference docs are your tools. Use them strategically.
- **Document decisions here:** CLAUDE.md is re-read every turn with a 40,000 character limit. Architecture decisions, file conventions, testing patterns, and "never do this" rules belong here, not in chat.

## Workflow Orchestration

### Skills-First Workflow

Every user request follows this sequence:

Request -> Load Skills -> Gather Context -> Execute

#### 1. Plan Mode

- Use `/plan` for non-trivial tasks with 3+ steps or architectural decisions.
- Default permission mode is `bypassPermissions`; plan mode is not globally enforced.
- If something goes sideways, stop and re-plan immediately.
- Write detailed specs upfront to reduce ambiguity.

#### 2. Sub-Agent Strategy

Deploy specialized sub-agents based on the current topic to manage the project lifecycle. Use domain-specific agents for research, planning, and implementation to ensure precision and prevent context drift.

- **Specialized Research Agents**
  - **Objective:** Maximize context collection through domain expertise.
  - **Function:** Deploy agents specialized in the specific topic or technical stack.
  - **Duty:** Offload exploration, documentation review, and parallel analysis to build a comprehensive knowledge base.
- **Planning Agents**
  - **Objective:** Architect a technical blueprint based on research findings.
  - **Function:** Define logic, dependencies, and edge cases.
  - **Compute:** Allocate more compute to complex problems to identify failure points early.
  - **Gatekeeper:** The plan must receive user approval before proceeding to implementation.
- **Implementation Agents**
  - **Objective:** Execute the approved plan with high fidelity.
  - **Function:** Operate on a one-task-per-agent basis for focused execution.
  - **Validation:** Run unit tests and self-correction loops once the task concludes.

Execution principles:

- **Dynamic Specialization:** Match sub-agent capabilities to the specific requirements of the task.
- **Task Atomicity:** Limit each sub-agent to a single, well-defined task to prevent hallucination.
- **Compute Scaling:** Increase the number of sub-agents for non-linear problems to ensure exhaustive coverage.

#### 3. Self-Improvement Loop

- Before executing any skill, read that skill's `references/errors-and-solutions.md`. Review past errors for relevance to the current task. If a prevention rule applies, implement it proactively before proceeding.
- After any correction from the user, update `tasks/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project workflow.

#### 4. Verification

- Before done, never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.

#### 5. Demand Elegance

- For non-trivial changes, pause and ask "is there a more elegant way?"
- If a fix feels hacky, revisit it and implement the elegant solution.
- Skip this for simple, obvious fixes. Do not over-engineer.
- Challenge your own work before presenting it.

#### 6. Autonomous Bug Fixing

- When given a bug report, fix it without asking for hand-holding.
- Point at logs, errors, and failing tests, then resolve them.
- Avoid unnecessary context switching from the user.
- Fix failing CI tests without being told how.

### Context Management Strategy

Central AI should conserve context to extend pre-compaction capacity:

- Delegate file explorations and low-lift tasks to sub-agents.
- Reserve context for coordination, user communication, and strategic decisions.
- For straightforward tasks with clear scope, skip heavy orchestration and execute directly.
- Use `/compact` proactively during long sessions. Treat it like a save point before context pressure hits.

Sub-agents should maximize context collection:

- Sub-agent context windows are temporary.
- After execution, unused capacity means wasted opportunity.
- Instruct sub-agents to read relevant files, load skills, and gather examples.

### Error Logging

Append structured entries to the relevant skill's `references/errors-and-solutions.md`. If the error does not map to a specific skill, append to `Skills/_shared/references/errors-and-solutions.md`. Use the wrap-up skill's error logging step to capture these at session end.

Format:

```markdown
### [Short descriptive title]

- **Task context:** what was being attempted
- **Error:** exact error message or symptom
- **Root cause:** why it happened
- **Fix:** what resolved it
- **Prevention rule:** what to check or do differently next time
```

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items.
2. **Verify Plan:** Check in before starting implementation.
3. **Track Progress:** Mark items complete as you go.
4. **Explain Changes:** Provide a high-level summary at each step.
5. **Document Results:** Add a review section to `tasks/todo.md`.
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections.

### Routing Decision

Use direct execution for simple, bounded tasks with clear scope, single-component changes, quick fixes, and trivial modifications.

Use sub-agent delegation for complex or multi-phase implementations, tasks requiring specialized domain expertise, and work that benefits from isolated context.

Use master orchestration for ambiguous requirements needing research, architectural decisions with wide impact, and multi-day features requiring session management.

## Operational Protocols

### Agent Coordination

Parallel execution is required when applicable:

- Multiple Task tool invocations in a single message.
- Independent tasks execute simultaneously.
- Bash commands run in parallel.

Sequential execution is required for dependencies:

- Database -> API -> Frontend.
- Research -> Planning -> Implementation.
- Implementation -> Testing -> Security.

## Quality & Verification

- Verify non-trivial work. Inspect output, test scripts, confirm service changes, or run validation.
- Surface data quality issues before drawing conclusions from any dataset.
- Decompose research questions before searching. Do not start with unfocused searches.
- Cite sources. If information comes from somewhere specific, say where.
- Surface disagreements when multiple sources conflict. Do not silently pick one.
- Never silently overwrite files the user may have reviewed or annotated. Show the diff first.
