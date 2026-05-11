-- Permit the disabled-by-default Kotlin worker engine identity for non-production
-- contract testing while preserving the neutral extraction identity invariant.

alter table document drop constraint if exists document_extraction_engine_check;
alter table document
  add constraint document_extraction_engine_check
  check (extraction_engine is null or extraction_engine in ('textract', 'kotlin_worker'));
