# Staging Rehearsal Evidence

Archive one dated evidence package for each true staging rehearsal:

```text
docs/evidence/staging-rehearsals/<YYYY-MM-DD>/
  manifest.json
  preflight-gates.md
  upload-and-conversion-path.md
  cloudflare-r2-kotlin-extraction-proof.md
  billing-and-webhook-sanity.md
  deletion-expiry.md
  audit-evidence.md
  alert-and-ops-dashboard-signal.md
```

Validate the manifest before launch signoff:

```powershell
pnpm check:staging-rehearsal-evidence docs/evidence/staging-rehearsals/<YYYY-MM-DD>/manifest.json
```

`manifest.json` is the release-level index. It must include:

```json
{
  "schemaVersion": 1,
  "rehearsalDate": "2026-05-14",
  "releaseSha": "5a6b2351b500024ab74b2f7c53b12e0afb478306",
  "vercelDeploymentUrl": "https://prizm-git-main-plknokos-projects.vercel.app",
  "stagingHost": "staging.prizmview.app",
  "launchGateOutput": "Launch gate passed for staging",
  "liveConnectorSmokeOutput": "supabase: ok\nstripe: ok\ns3: ok\nredis: ok",
  "uploadRequestId": "req_upload_123",
  "convertRequestId": "req_convert_123",
  "statusRequestId": "req_status_123",
  "exportRequestId": "req_export_123",
  "auditQueryOutput": "document.upload_requested stripe.checkout.session.completed",
  "stripeEventIds": ["evt_123"],
  "deletionSweepEvidence": "sweep_run_id=delete_sweep_123",
  "deletionMonitorEvidence": "monitor_run_id=delete_monitor_123",
  "sentryAlertLinkOrDrillId": "https://prizm.sentry.io/issues/123",
  "operatorSignoff": {
    "operator": "Ops",
    "result": "pass",
    "signedAt": "2026-05-14T15:30:00.000Z"
  },
  "sectionEvidence": {
    "preflight-gates": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/preflight-gates.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "upload-and-conversion-path": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/upload-and-conversion-path.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "cloudflare-r2-kotlin-extraction-proof": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/cloudflare-r2-kotlin-extraction-proof.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "billing-and-webhook-sanity": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/billing-and-webhook-sanity.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "deletion-expiry": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/deletion-expiry.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "audit-evidence": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/audit-evidence.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    },
    "alert-and-ops-dashboard-signal": {
      "artifactPath": "docs/evidence/staging-rehearsals/2026-05-14/alert-and-ops-dashboard-signal.md",
      "collectedAt": "2026-05-14T15:30:00.000Z",
      "status": "pass"
    }
  }
}
```

Use `status: "blocked"` only when the blocked item maps to an unimplemented roadmap phase and the artifact links the issue or roadmap reference.
