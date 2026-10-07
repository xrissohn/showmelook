-- product_feedback had two CHECK constraints on action_type:
--   product_feedback_action_type_check (2026-01-20, click/like/cart/purchase/view/payment_notify_request)
--   action_type_check                  (2026-01-23, adds dislike/remove/style_like/style_dislike)
-- The older one was never dropped, so inserts of 'style_like'/'style_dislike' (look feedback) and
-- 'dislike'/'remove' failed with 23514. The newer one already allows every value, so drop the old one.
ALTER TABLE public.product_feedback DROP CONSTRAINT IF EXISTS product_feedback_action_type_check;
