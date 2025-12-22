-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create generated-looks storage bucket for AI generated images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-looks', 'generated-looks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated looks
CREATE POLICY "Generated looks are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-looks');

CREATE POLICY "Users can upload generated looks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-looks' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their generated looks"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-looks' AND auth.uid() IS NOT NULL);