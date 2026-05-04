-- 0005_add_missing_fk_indexes.sql
-- Add indexes for foreign key columns not covered by existing primary, unique,
-- or leftmost-prefix indexes.

create index if not exists api_key_user_idx on api_key(user_id);
create index if not exists document_uploaded_by_idx on document(uploaded_by);
create index if not exists credit_ledger_document_idx on credit_ledger(document_id);
create index if not exists audit_event_actor_user_idx on audit_event(actor_user_id);
