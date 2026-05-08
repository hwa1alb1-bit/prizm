# ADR-007: Rate limiting

Status: accepted
Date: 2026-04-28

## Context

The audit flagged the target's lack of rate-limit transparency (F8) and the absence of any rate-limit headers as a high-severity gap (S6 implications). PRIZM ships rate limiting from day one with public, predictable headers.

## Decision

Rate limits are enforced through Upstash Redis with the fixed-window helper in
`lib/server/ratelimit.ts`. The current app uses authenticated Supabase user IDs
for app routes and ops admin user IDs for provider refreshes. API-key scoped
budgets stay a future extension until API keys are issued to customers.

Published budgets:

- Upload and conversion routes: 60 requests / minute / authenticated user.
- Document status polling: 1200 requests / minute / authenticated user.
- Billing Checkout and Customer Portal session creation: 60 requests / minute / authenticated user.
- Export creation and direct export streaming: 60 requests / minute / authenticated user.
- Export download URL creation: 600 requests / minute / authenticated user.
- Privacy data export and account deletion requests: 2 accepted requests / 24 hours / authenticated user.
- Ops manual provider refresh: 3 requests / 5 minutes / ops admin and 12 requests / 5 minutes / provider.
- Webhooks (Stripe): unlimited, with idempotency by `event.id`.

Limited routes return `RateLimit-Limit`, `RateLimit-Remaining`,
`RateLimit-Reset`, and legacy `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, `X-RateLimit-Reset` headers when a limiter result is
available. HTTP 429 responses also return `Retry-After` and an RFC 7807 problem
document. Limits are documented at `/docs/rate-limits`.

## Consequences

Eased:

- Customers can build retry logic with confidence.
- Abuse from a single IP is bounded.
- Per-scope budgets mean a noisy status poller cannot consume the upload or billing budget.

Locked in:

- Upstash Redis is in the hot path. Outage degrades to fail-open (log + Sentry alert) to keep the service available.

## Alternatives considered

- Vercel built-in rate limiting: less control, no per-key granularity.
- In-memory limiter on Vercel functions: breaks across function invocations.
- No rate limit: copies the target's mistake.

## Verification

- A loop of 100 requests / minute from a single IP starts seeing 429 before the loop ends.
- 429 response includes `Retry-After` and follows ADR-006 problem+json shape.
- Upload, status, billing, and export route tests assert that 429 responses stop downstream work before provider calls or database writes.

## References

- S6, F8 from PRIZM/runs/2026-04-28-bankstatementconverter/tables/
