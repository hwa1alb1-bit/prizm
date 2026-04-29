# ADR-004: Deletion enforcement, belt and suspenders

Status: accepted
Date: 2026-04-28

## Context

The audit's central data-flow gap was that the target's "24h auto-delete" claim was a policy claim only. No technical attestation. PRIZM's trust-first thesis depends on making the same promise verifiable. HR4, HR11, F6, S9 all map here.

## Decision

Three layers of deletion enforcement, all running independently:

1. **S3 lifecycle expiration**: every uploaded object has a 1-day lifecycle rule. AWS expires the object regardless of any application code state.

2. **Scheduled application sweep**: a Vercel Cron job runs every 15 minutes and deletes `document` + `statement` rows where `expires_at < now() and deleted_at is null`. The job also confirms the S3 object is gone by calling HeadObject (a 404 is the expected result). On any anomaly the job writes an `audit_event` and pages Sentry.

3. **Per-deletion audit events + email receipt**: every deletion writes an `audit_event` row. The user receives a Resend email confirming deletion within 5 minutes of the deadline.

A continuous monitor (a separate cron job at 5-minute cadence) compares `expires_at < now() - interval '5 minutes'` rows where `deleted_at is null`. If the monitor finds any survivors, it pages Sentry P1. The expected count is always zero.

## Consequences

Eased:
- Even if app code fails, S3 still expires. Even if S3 misfires, app code sweeps. Even if both partially succeed, the monitor flags it.
- User-verifiable: the email receipt is evidence the user can keep.
- SOC 2 evidence: the audit_event log gives an auditor a query to run.

Locked in:
- Vercel Cron has minute-level resolution. Sub-minute deletion guarantees are not a Phase 1 promise.
- Resend deliverability is in the trust path now.

## Alternatives considered

- S3 lifecycle alone: simpler but no per-deletion confirmation to user, no audit trail of who deleted what.
- App-code only: no defense if the app misbehaves.

## Verification

- A test object uploaded to S3 with `expires_at = now() + 1 minute` is gone from S3 within 16 minutes (lifecycle is once-daily floor in AWS docs but in practice <24h; the cron sweep handles the floor). Document and statement rows are gone too. Monitor reports zero stale rows.
- The user receives a deletion confirmation email within 5 minutes of `expires_at`.
- Forcing a Cron failure (disable the route) for 1 hour: monitor pages Sentry within 5 minutes of the first stale row.

## References

- HR4, HR11, F6, S9 from PRIZM/runs/2026-04-28-bankstatementconverter/handoffs/security.md and data_privacy.md
