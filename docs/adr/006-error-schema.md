# ADR-006: Error response schema

Status: accepted
Date: 2026-04-28

## Context

The audit faulted the target API for having no documented error code schema. Clients had to guess between auth failure, rate limit, validation error, and server error. This is exactly the gap PRIZM closes by being trust-first.

## Decision

Every error response follows RFC 7807 `application/problem+json`:

```json
{
  "type": "https://prizmview.app/errors/<code>",
  "title": "Human-readable title",
  "status": 400,
  "detail": "Human-readable detail. May include user-facing remediation.",
  "instance": "/api/v1/document/abc123",
  "code": "PRZM_<CATEGORY>_<NAME>",
  "trace_id": "01HXX...."
}
```

`code` is the canonical machine-readable identifier (e.g. `PRZM_VALIDATION_FILE_TOO_LARGE`, `PRZM_AUTH_KEY_REVOKED`, `PRZM_RATE_LIMIT_EXCEEDED`). Categories: `VALIDATION`, `AUTH`, `RATE_LIMIT`, `BILLING`, `OCR`, `INTERNAL`. Trace IDs come from Sentry / OpenTelemetry and let support correlate user reports to logs.

The full error catalog lives at `content/errors.mdx` and renders at `/docs/errors`.

## Consequences

Eased:

- Clients can match on `code` for stable error handling.
- Support can ask for a `trace_id` and find the request immediately.
- Auditors get a clean log surface.

Locked in:

- We must keep the error catalog in sync with the code. Test-enforced.

## Alternatives considered

- Custom JSON shape: works, but RFC 7807 is the standard and parsers exist.
- Status code only: not enough information for clients.

## Verification

- Every error path returns content-type `application/problem+json` and matches the schema.
- The error catalog page lists every `code` returned by the codebase. CI test scans server code for thrown error codes and diffs against the catalog.

## References

- RFC 7807
