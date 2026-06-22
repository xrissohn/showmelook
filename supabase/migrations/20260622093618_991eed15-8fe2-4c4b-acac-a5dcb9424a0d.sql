
-- cafe24_tenants: explicitly deny INSERT/UPDATE/DELETE for non-service roles
CREATE POLICY "No direct insert to tenants" ON public.cafe24_tenants FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct update to tenants" ON public.cafe24_tenants FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct delete to tenants" ON public.cafe24_tenants FOR DELETE TO public USING (false);

-- purchase_intents: explicitly deny client writes (edge functions use service_role which bypasses RLS)
CREATE POLICY "No direct insert to purchase_intents" ON public.purchase_intents FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct update to purchase_intents" ON public.purchase_intents FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct delete to purchase_intents" ON public.purchase_intents FOR DELETE TO public USING (false);
