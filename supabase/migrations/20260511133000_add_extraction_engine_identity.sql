-- Add neutral extraction job identity while keeping textract_job_id as the
-- v1 compatibility alias for the current Textract-backed engine.

alter table document
  add column if not exists extraction_engine text,
  add column if not exists extraction_job_id text;

update document
set
  extraction_engine = coalesce(extraction_engine, 'textract'),
  extraction_job_id = coalesce(extraction_job_id, textract_job_id)
where textract_job_id is not null
  and (extraction_engine is null or extraction_job_id is null);

alter table document drop constraint if exists document_extraction_identity_pair_check;
alter table document
  add constraint document_extraction_identity_pair_check
  check (
    (extraction_engine is null and extraction_job_id is null)
    or (extraction_engine is not null and extraction_job_id is not null)
  );

alter table document drop constraint if exists document_extraction_engine_check;
alter table document
  add constraint document_extraction_engine_check
  check (extraction_engine is null or extraction_engine in ('textract'));

create index if not exists document_extraction_job_idx
  on document(extraction_engine, extraction_job_id)
  where extraction_job_id is not null;
