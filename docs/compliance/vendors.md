# Vendor Inventory

This inventory supports SOC 2 vendor management and incident response. It should be reviewed at least quarterly and whenever a new production provider is added.

## Production Vendors

| Vendor     | Purpose                                                                       | Data touched                                                                                        | DPA / terms link                                    | Evidence                                      |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Supabase   | Auth, Postgres, RLS-protected application data, service-role server workflows | User profile, workspace, document metadata, statement output, subscription mirror, privacy requests | https://supabase.com/legal/dpa                      | `audit_event`, migrations, RLS, access review |
| AWS        | S3 object storage, Textract extraction, KMS encryption, SES mail paths        | PDF binaries, object metadata, Textract job metadata, receipt delivery metadata                     | https://aws.amazon.com/service-terms/               | AWS request IDs, deletion evidence, receipts  |
| Stripe     | Billing and subscription lifecycle                                            | Customer ID, subscription ID, plan, billing cycle, invoice/payment metadata                         | https://stripe.com/legal/dpa                        | Stripe delivery logs, `audit_event` rows      |
| Vercel     | Hosting, API routes, scheduled cron execution                                 | Request metadata, deployment logs, cron execution metadata                                          | https://vercel.com/legal/dpa                        | Deployment IDs, request IDs, cron schedule    |
| Sentry     | Error monitoring                                                              | Error traces, request IDs, trace IDs, limited diagnostic metadata                                   | https://sentry.io/legal/dpa/                        | Issue IDs and release/deployment tags         |
| Resend     | Transactional email and deletion receipts                                     | Recipient email and delivery metadata                                                               | https://resend.com/legal/dpa                        | Delivery logs and receipt failures            |
| Upstash    | Rate limiting or queue-adjacent controls if enabled                           | Request counters and derived keys                                                                   | https://upstash.com/trust/dpa.pdf                   | Provider dashboard and ops snapshots          |
| Cloudflare | Edge/security/DNS if enabled                                                  | Request metadata and DNS/security configuration                                                     | https://www.cloudflare.com/cloudflare-customer-dpa/ | Firewall/DNS records and ops snapshots        |

## Review Controls

- Confirm each provider exists in `ops_provider` when it is part of the operational dashboard.
- Confirm required provider metrics have current `ops_usage_snapshot` rows from `/api/ops/collect`.
- Confirm failed or partial collection runs are represented in `ops_collection_run`.
- Confirm access is limited to active operators and reflected in `ops_admin` where the internal ops dashboard is used.

## Audit Completeness

Evidence for vendor review is complete when the auditor can trace provider purpose, data class, access owner, health telemetry, incident runbook, and last review date. Attach current `ops_usage_snapshot`, `ops_collection_run`, provider contract/security page, and access review notes to the evidence package.
