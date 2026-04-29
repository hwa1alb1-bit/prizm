# ADR-003: Multi-tenancy from day one

Status: accepted
Date: 2026-04-28

## Context

Phase 3 requires multi-tenant workspaces with RBAC and audit logs (HC4). Phase 1 ships single-tenant UI to accountants who own their own workspace. The audit's roadmap explicitly delays the UI flip to Phase 3, but if the schema is single-tenant in Phase 1 the Phase 3 work becomes a rewrite.

## Decision

Every domain table carries a `workspace_id` column from day one. RLS policies enforce membership through `user_profile.workspace_id`. The Phase 1 UI assumes one workspace per user and creates exactly one workspace at signup via the `bootstrap_user_workspace` trigger. Phase 3 enables multi-workspace assignment, role escalation, and the audit-log UI.

## Consequences

Eased:
- Phase 3 is a UI and policy expansion, not a schema rewrite.
- All API routes read workspace context the same way regardless of phase.
- Audit events tie to a workspace from the first event.

Locked in:
- Every join carries `workspace_id`. Slightly more verbose SQL.
- `auth.uid()` lookups always pass through `user_profile` to resolve workspace.

## Alternatives considered

- Single-tenant schema in Phase 1, multi-tenant rewrite in Phase 3. Faster to ship Phase 1 by maybe a week, but Phase 3 cost is an order of magnitude larger and produces a downtime window for backfill. Not worth it.
- Schema-per-tenant. Strong isolation but operational nightmare for a Phase 1 with hundreds of accounts.

## Verification

- Migration 0001 has `workspace_id` on every domain table.
- Every RLS policy starts with a workspace-membership check.
- A test user signing up gets exactly one workspace with role `owner`.
- A test user from workspace A trying to read a row from workspace B gets zero results, not an error.

## References

- PRIZM Phase 1 plan, Domain model section
- HC4, F5, F11 from PRIZM/runs/2026-04-28-bankstatementconverter/tables/
