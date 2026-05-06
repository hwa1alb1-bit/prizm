# Billing Stripe Webhook Replay Runbook

## Owner

Primary: Billing owner. Backup: Engineering lead with Stripe dashboard and production database access.

## Severity

Sev 1 when subscriptions, credits, or payment access are incorrect for multiple customers. Sev 2 when a single customer subscription is stale or a webhook replay is needed. Sev 3 when replay is for evidence completeness only.

## Detection

- Stripe dashboard shows undelivered events for `/api/v1/webhooks/stripe`.
- Application returns `PRZM_AUTH_STRIPE_SIGNATURE_INVALID`, `PRZM_INTERNAL_STRIPE_WEBHOOK_CONFIG`, or `PRZM_INTERNAL_STRIPE_WEBHOOK_FAILED`.
- `audit_event` lacks the expected `stripe.*` event for a Stripe event ID.
- `subscription` rows do not match Stripe customer, subscription, plan, cycle, or status.
- `credit_ledger` adjustments are missing or inconsistent after billing changes.

## Response

First 15 minutes:

1. Confirm the Stripe event ID, event type, livemode, customer ID, and subscription ID.
2. Check whether `audit_event.metadata->>'stripe_event_id'` already exists to avoid duplicate side effects.
3. Inspect current `subscription` by `stripe_customer_id` and `stripe_subscription_id`.
4. Replay from Stripe dashboard only for verified production endpoint and signing secret.
5. If subscription state is materially wrong, document the customer impact before manual correction.

User comms:

- For plan access, invoice, or payment errors, acknowledge the billing issue and state whether access has been restored.
- Do not expose Stripe internals; refer to account, plan, payment, or invoice state.

Evidence to collect:

- Stripe event JSON, delivery attempts, response codes, and replay timestamp.
- `audit_event` row for `stripe.${event.type}` with `stripe_event_id`.
- Before and after `subscription` row.
- Any related `credit_ledger` rows for grants, conversion, refund, or manual adjustment.
- Vercel request ID, trace ID, and Sentry issue if the webhook handler failed.

Expected audit events:

- `stripe.customer.subscription.created`
- `stripe.customer.subscription.updated`
- `stripe.customer.subscription.deleted`
- Any other `stripe.*` event received by the webhook handler

## Verification

- Stripe event delivery shows success for the production endpoint.
- `audit_event` has exactly the expected webhook audit entry for the replayed event ID.
- `subscription` mirrors Stripe customer, subscription, plan, billing cycle, status, current period, and cancellation state.
- Customer entitlement or credit issue is resolved and documented.
