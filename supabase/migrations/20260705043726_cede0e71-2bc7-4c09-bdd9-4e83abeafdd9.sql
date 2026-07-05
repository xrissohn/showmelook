DROP POLICY IF EXISTS "Users can update their own cart" ON public.cart_items;
CREATE POLICY "Users can update their own cart" ON public.cart_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own looks" ON public.generated_looks;
CREATE POLICY "Users can update their own looks" ON public.generated_looks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);