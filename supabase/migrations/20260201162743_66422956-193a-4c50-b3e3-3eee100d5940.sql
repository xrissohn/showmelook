-- Drop the partial unique index and create a proper unique constraint
DROP INDEX IF EXISTS idx_coupang_daily_reports_unique;

-- Create a proper unique constraint (not partial)
ALTER TABLE public.coupang_daily_reports 
ADD CONSTRAINT coupang_daily_reports_date_subid_unique 
UNIQUE (report_date, sub_id);