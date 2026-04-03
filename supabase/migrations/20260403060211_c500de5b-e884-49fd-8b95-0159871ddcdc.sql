ALTER TABLE public.referral_codes ALTER COLUMN max_uses SET DEFAULT 10;
UPDATE public.referral_codes SET max_uses = 10 WHERE max_uses = 5;