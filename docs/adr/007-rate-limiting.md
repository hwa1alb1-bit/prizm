# ADR-007: Rate limiting

Status: accepted
Date: 2026-04-28

## Context

The audit flagged the target's lack of rate-limit transparency (F8) and the absence of any rate-limit headers as a high-severity gap (S6 implications). PRIZM ships rate limiting from day one with public, predictable headers.

## Decision

Rate limits enforced via Upstash Redis token-bucket. Per-IP for unauthenticated traffic. Per-API-key-and-scope for authenticated traffic. Per-account aggregate cap for paid plans. Default budgets:

- Unauthenticated: 60 requests / minute / IP
- Authenticated read: 600 requests / minute / key
- Authenticated upload: 60 requests / minute / key
- Authenticated status poll: 1200 requests / minute / key
- Webhooks (Stripe): unlimited (idempotency by `event.id`)

Every response carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After` (on 429). Limits are documented at `/docs/rate-limits`.

## Consequences

Eased:

- Customers can build retry logic with confidence.
- Abuse from a single IP is bounded.
- Per-key scoping means a leaked read key cannot DoS the upload pipeline.

Locked in:

- Upstash Redis is in the hot path. Outage degrades to fail-open (log + Sentry alert) to keep the service available.

## Alternatives considered

- Vercel built-in rate limiting: less control, no per-key granularity.
- In-memory limiter on Vercel functions: breaks across function invocations.
- No rate limit: copies the target's mistake.

## Verification

- A loop of 100 requests / minute from a single IP starts seeing 429 before the loop ends.
- 429 response includes `Retry-After` and follows ADR-006 problem+json shape.
- A leaked `read` scoped key cannot exceed the read budget. Upload endpoints reject the read key with 403.

## References

- S6, F8 from PRIZM/runs/2026-04-28-bankstatementconverter/tables/
