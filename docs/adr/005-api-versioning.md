# ADR-005: API versioning

Status: accepted
Date: 2026-04-28

## Context

The audit's product_market lane noted that competitors lack rate-limit transparency and versioning policy (F8). PRIZM's API is a public surface and accountant tooling tends to live for years. We need a versioning rule before customers integrate.

## Decision

All public API endpoints live under `/api/v1/`. Breaking changes go to `/api/v2/`. v1 stays alive for at least 6 months past v2 launch. Deprecation notices appear in `Deprecation` and `Sunset` response headers per RFC 8594 starting 90 days before retirement. The OpenAPI spec at `/api/v1/openapi.json` is the source of truth for public client integrations and is tested against the implemented route list.

Internal-only endpoints are not part of the public versioning contract. Cron and ops handlers live outside `/api/v1/`. The Stripe webhook keeps its deployed `/api/v1/webhooks/stripe` path for provider compatibility, but it is excluded from `/api/v1/openapi.json` and from public client guarantees.

## Consequences

Eased:

- Customers know what they sign up for.
- Internal refactors do not break public clients.

Locked in:

- We carry v1 surface area until at least 6 months past v2 ship.

## Alternatives considered

- Header versioning (`Accept: application/vnd.prizm.v1+json`): cleaner technically, more friction for typical curl users.
- No versioning, breaking changes as they come: developer-hostile.

## Verification

- Every public route is reachable under `/api/v1/`.
- `/api/v1/openapi.json` publishes every implemented public v1 route and excludes the Stripe webhook route (test in CI).
- A deprecated endpoint returns `Deprecation: true` and `Sunset: <date>` headers.

## References

- F8 from PRIZM/runs/2026-04-28-bankstatementconverter/tables/feature_requests.md
