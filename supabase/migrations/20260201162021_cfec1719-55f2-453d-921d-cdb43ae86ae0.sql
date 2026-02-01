-- Create coupang_daily_reports table to store daily earnings report data
CREATE TABLE public.coupang_daily_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date date NOT NULL,
  tracking_code text,
  sub_id text,
  click_count integer DEFAULT 0,
  order_count integer DEFAULT 0,
  cancel_count integer DEFAULT 0,
  gmv integer DEFAULT 0,
  commission integer DEFAULT 0,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX idx_coupang_daily_reports_unique 
ON public.coupang_daily_reports (report_date, sub_id) 
WHERE sub_id IS NOT NULL;

-- Create index for faster lookups by sub_id
CREATE INDEX idx_coupang_daily_reports_sub_id 
ON public.coupang_daily_reports (sub_id) 
WHERE sub_id IS NOT NULL;

-- Create index for unprocessed records
CREATE INDEX idx_coupang_daily_reports_unprocessed 
ON public.coupang_daily_reports (processed) 
WHERE processed = false;

-- Enable RLS
ALTER TABLE public.coupang_daily_reports ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can manage coupang_daily_reports"
ON public.coupang_daily_reports
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add comment for documentation
COMMENT ON TABLE public.coupang_daily_reports IS 'Stores daily earnings reports from Coupang Partners API for purchase tracking';