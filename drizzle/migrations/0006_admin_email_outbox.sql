-- One-off service emails (support notices, apologies, account fixes) sent from
-- noreply@showmelook.com (2026-10-07). Rows can only be written with service-role / database
-- access; the send-outbox-email edge function sends the pending rows via Resend.
CREATE TABLE IF NOT EXISTS public.admin_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL CHECK (position('@' in to_email) > 1),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 300),
  html text NOT NULL,
  text_body text,
  reply_to text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.admin_email_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_email_outbox FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.admin_email_outbox TO service_role;

-- Atomically hands pending rows to one sender so two overlapping calls never send twice.
CREATE OR REPLACE FUNCTION public.claim_admin_email_outbox(_limit integer DEFAULT 5)
RETURNS SETOF public.admin_email_outbox
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.admin_email_outbox AS o
     SET status = 'sending', attempts = o.attempts + 1
   WHERE o.id IN (
     SELECT q.id
       FROM public.admin_email_outbox AS q
      WHERE q.status = 'pending' AND q.attempts < 3
      ORDER BY q.created_at
      LIMIT LEAST(GREATEST(COALESCE(_limit, 5), 1), 10)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING o.*;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_email_outbox(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_admin_email_outbox(integer) TO service_role;
