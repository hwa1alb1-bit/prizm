# ADR-002: Authentication

Status: accepted
Date: 2026-04-28

## Context

The audit flagged HC9 (password hashing + complexity), HR1 (email normalization), HR3 (single-use 15-minute reset tokens), and HR2 (cookie posture) as Phase 1 hardening items. Auth has to be solid from day one because every later compliance control assumes a known user.

## Decision

Use Supabase Auth as the only auth provider for Phase 1. Magic-link email is the primary flow. Password is a fallback for users on providers with poor magic-link deliverability. Argon2id is the password hash via Supabase. Email is normalized to lowercase at registration and at lookup. Password reset tokens are single-use and expire in 15 minutes. Session cookies are HttpOnly, Secure, SameSite=Lax. HCAPTCHA is added on the signup form when abuse signals indicate it.

## Consequences

Eased:

- No custom auth code paths. Supabase handles password hashing, reset tokens, session cookies, MFA hooks.
- Magic link drives adoption from accountants who do not love passwords.
- Argon2id closes HC9 with a vendor default.

Locked in:

- Supabase user-record schema. Migration off Supabase Auth requires a one-shot password export and a forced reset round.

## Alternatives considered

- NextAuth.js (Auth.js): more flexible, but we own more of the auth surface and SOC 2 controls become harder to evidence.
- Clerk: best-in-class DX but adds another vendor (and DPA) for marginal gain. Cost scales with seats.
- Custom Argon2id: maximum control, maximum risk. No.

## Verification

- A user with email `Bob@Example.com` registers. Logging in as `bob@example.com` resolves to the same account. Regression test green.
- Password reset token used twice. Second attempt returns 401. Test green.
- A weak password ("password") at signup returns 400 from the API.
- `Set-Cookie` on a logged-in session shows `HttpOnly; Secure; SameSite=Lax`.

## References

- PRIZM/runs/2026-04-28-bankstatementconverter/handoffs/security.md (S2, S7, S13, S14)
