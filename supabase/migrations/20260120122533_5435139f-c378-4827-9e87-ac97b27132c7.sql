-- Drop the old check constraint and add new one with payment_notify_request
ALTER TABLE public.product_feedback 
DROP CONSTRAINT product_feedback_action_type_check;

ALTER TABLE public.product_feedback 
ADD CONSTRAINT product_feedback_action_type_check 
CHECK (action_type IN ('click', 'like', 'cart', 'purchase', 'view', 'payment_notify_request'));