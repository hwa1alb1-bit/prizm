# Launch Rollback Runbook

Use this runbook when a staging or production launch gate fails after deploy, or when a recent app or database change creates a customer-facing, security, deletion, billing, or auditability risk.

## Owners

- Incident commander: PRIZM engineering owner on call.
- App deploy owner: engineer with Vercel project access.
- Database owner: engineer with Supabase migration and backup access.
- Communications owner: customer/support contact for launch-impacting incidents.

## Severity

- P1: auth, upload, conversion, billing, deletion, audit logging, or provider credential failures in production.
- P2: staging launch rehearsal failure, degraded ops dashboard, or non-critical provider telemetry gap.
- P3: documentation or evidence gap that does not affect active launch safety.

## Detection

- GitHub Actions launch gate failure.
- Vercel deployment health, error, or rollback signal.
- Sentry error spike, missing source maps, or alert routing failure.
- Ops Dashboard red provider, stale collector data, failed deletion sweep, or billing risk alert.
- Manual staging rehearsal failure.

## App Deploy Rollback

### When To Roll Back

- A new Vercel deployment breaks auth, upload, billing, deletion, ops health, or public trust pages.
- `/api/health` or protected ops health fails after deploy.
- Sentry shows a new deploy-correlated error spike.
- Security headers or launch gates fail after the deployment is promoted.

### Preflight

- Identify the bad deployment SHA, Vercel deployment URL, environment, and release time.
- Identify the last known-good deployment URL and SHA.
- Confirm whether the app deploy depends on a database migration.
- Freeze further deploys until the incident commander assigns an owner.
- Capture current launch gate output, `/api/health`, protected ops health, and Sentry links.

### Procedure

- Prefer promoting the last known-good Vercel deployment for the same environment.
- If promotion is unavailable, redeploy the last known-good SHA with the same environment variables.
- Do not change provider credentials during rollback unless the incident is credential-related.
- If the app is incompatible with the current database schema, pause and use the database rollback decision path before promoting.
- Record the deployment URL, SHA, timestamp, operator, and command or console action used.

## Database Migration Rollback

### When To Roll Back

- A migration breaks RLS, workspace isolation, audit writes, upload state transitions, billing state, deletion sweeps, or ops snapshots.
- A migration creates destructive or corrupted data that cannot be safely fixed by the app layer.
- A migration blocks app rollback because the last known-good deployment is schema-incompatible.

### Preflight

- Identify migration ID, migration status, environment, app SHA, and dependent deploy.
- Run `supabase migration list` or equivalent environment evidence.
- Confirm backup or point-in-time recovery availability before changing data.
- Capture row counts and sample queries for affected tables.
- Classify the migration as backward-compatible, app-coupled, data-destructive, RLS-sensitive, or trigger/function-related.

### Procedure

- Prefer a roll-forward fix for production migrations that have already been applied.
- Use tested rollback SQL only when the down path is known and data-safe.
- Use point-in-time recovery only for destructive or corrupted data cases where roll-forward is unsafe.
- Avoid ad hoc console edits. Record exact SQL, migration file, command, operator, and timestamp.
- If locks, missing backups, or app/schema incompatibility make rollback unsafe, abort and escalate.

## Response

- Open or update the incident record with severity, environment, affected paths, and owner.
- Freeze deploys and migrations until rollback or roll-forward is complete.
- Announce customer-facing impact only after the incident commander confirms scope.
- Keep launch gates, provider health, and audit evidence attached to the incident.

## Verification

- `pnpm check:launch-gates` passes for the affected environment.
- `/api/health` returns public shallow status without raw provider errors.
- Protected ops health and Ops Dashboard show expected green or accepted-gray providers.
- Auth login, document presign, S3 browser PUT, Stripe webhook handling, deletion sweep, and deletion monitor smoke checks pass.
- Sentry receives errors with source maps and alert routing reaches the expected channel.
- Audit events exist for the rollback-relevant writes or operator actions.

## Abort / Escalation

- Abort rollback if the last known-good app cannot run against the current schema.
- Abort database rollback if backups are missing, locks are unsafe, or data loss risk is not understood.
- Escalate to provider support when Vercel, Supabase, Stripe, S3, Sentry, Resend, or Upstash control planes block recovery.

## Evidence

- Deployment URLs and SHAs before and after rollback.
- Migration IDs and before/after migration status.
- Launch gate output, health checks, ops screenshots, Sentry links, and audit query outputs.
- Operator, timestamps, commands, and console actions.

## Post-Rollback

- Create a root cause issue and forward-fix plan.
- Add or update regression tests, migration tests, or launch checklist items that would have caught the issue.
- Review why staging rehearsal did not catch the failure.
- Re-enable deploys only after verification evidence is attached.
