CREATE POLICY "Admins can upload survey assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-looks' AND (storage.foldername(name))[1] = 'survey' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update survey assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-looks' AND (storage.foldername(name))[1] = 'survey' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete survey assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-looks' AND (storage.foldername(name))[1] = 'survey' AND public.has_role(auth.uid(), 'admin'));