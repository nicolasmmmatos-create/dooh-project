CREATE POLICY "Users can update own videos directly"
ON public.videos FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);