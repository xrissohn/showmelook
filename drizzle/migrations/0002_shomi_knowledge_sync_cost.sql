ALTER TABLE public.shomi_knowledge_files
  ADD COLUMN IF NOT EXISTS source_chars integer,
  ADD COLUMN IF NOT EXISTS summary_chars integer,
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS sync_cost_credits numeric(10,4);