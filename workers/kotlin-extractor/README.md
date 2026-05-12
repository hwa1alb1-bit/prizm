# PRIZM Kotlin Extractor

This module is the local JVM worker slice for selectable-text PDF extraction. It uses PDFBox to extract text, normalizes supported credit-card statements into PRIZM statement JSON, and leaves the Next.js app responsible for auth, billing, storage, review, export, and audit evidence.

## Local Test Fixtures

Do not commit real statement PDFs. Put local PDFs in `fixtures-local/` or point `PRIZM_EXTRACTOR_PDF_FIXTURE_DIR` at an external directory:

```powershell
$env:PRIZM_EXTRACTOR_PDF_FIXTURE_DIR = 'C:\path\to\local\statement-fixtures'
.\gradlew.bat test
```

From the repo root:

```powershell
$env:PRIZM_EXTRACTOR_PDF_FIXTURE_DIR = 'C:\path\to\local\statement-fixtures'
pnpm test:kotlin-extractor
```

The launch scope is text-based PDFs only. PDFs with no selectable text return a failed worker response instead of falling through to OCR.
