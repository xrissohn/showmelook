-- Allow admins to view all product_feedback
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.product_feedback;

CREATE POLICY "Users can view own feedback or admins view all"
ON public.product_feedback
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete any feedback
CREATE POLICY "Admins can delete any feedback"
ON public.product_feedback
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));