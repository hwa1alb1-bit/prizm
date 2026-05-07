# Subprocessor Register

PRIZM uses subprocessors to provide hosting, authentication, database, document extraction, object storage, billing, observability, email, and edge/security services. This register is customer-facing source material and must stay aligned with the vendor inventory.

## Current Subprocessors

| Subprocessor        | Service category  | Processing activity                                                                                                                                          | Customer data categories                                                                        | DPA / terms link                                    |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Supabase            | Auth and database | Stores workspace, user profile, document metadata, statement JSON, subscription mirror, credit ledger, privacy request, audit, and deletion evidence records | Account, workspace, billing mirror, document metadata, extracted statement data, audit metadata | https://supabase.com/legal/dpa                      |
| Amazon Web Services | S3 and Textract   | Stores uploaded PDFs temporarily and processes PDFs for extraction                                                                                           | PDF uploads, S3 object metadata, Textract job metadata                                          | https://aws.amazon.com/service-terms/               |
| Stripe              | Billing           | Processes payment and subscription events                                                                                                                    | Customer billing identifiers, subscription status, plan metadata                                | https://stripe.com/legal/dpa                        |
| Vercel              | Hosting and cron  | Runs web application, APIs, and scheduled ops/deletion jobs                                                                                                  | Request metadata and operational logs                                                           | https://vercel.com/legal/dpa                        |
| Sentry              | Observability     | Captures errors and traces                                                                                                                                   | Error context, request IDs, trace IDs, limited diagnostic metadata                              | https://sentry.io/legal/dpa/                        |
| Resend              | Email             | Sends transactional email and deletion receipts                                                                                                              | Recipient email and delivery metadata                                                           | https://resend.com/legal/dpa                        |
| Upstash             | Rate limiting     | Maintains usage counters when enabled                                                                                                                        | Request counters and derived keys                                                               | https://upstash.com/trust/dpa.pdf                   |
| Cloudflare          | Edge/security/DNS | Provides DNS, edge controls, and security telemetry when enabled                                                                                             | Request metadata and DNS/security configuration                                                 | https://www.cloudflare.com/cloudflare-customer-dpa/ |

## Change Management

- Add a new subprocessor before production traffic or customer data is routed through it.
- Document service category, processing activity, data categories, access owner, DPA link, and region posture.
- Update `docs/compliance/vendors.md`, relevant runbooks, and SOC 2 evidence queries when a new provider adds telemetry or audit requirements.
- Keep customer notices aligned with contractual requirements.

## Audit Completeness

Quarterly evidence should include this register, vendor inventory, provider health snapshots, access review, and any incidents or exceptions for the review period.
