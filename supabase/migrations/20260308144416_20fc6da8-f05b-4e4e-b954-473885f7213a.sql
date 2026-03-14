
-- Add user_id column to videos table for standalone uploads
ALTER TABLE public.videos ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill existing videos with the user_id from their playlist
UPDATE public.videos v
SET user_id = p.user_id
FROM public.playlists p
WHERE v.playlist_id = p.id;

-- Create policy allowing users to insert videos they own (without playlist)
CREATE POLICY "Users can insert own videos"
ON public.videos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy allowing users to select own videos (without playlist)
CREATE POLICY "Users can select own videos"
ON public.videos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create policy allowing users to delete own videos
CREATE POLICY "Users can delete own videos directly"
ON public.videos FOR DELETE TO authenticated
USING (auth.uid() = user_id);
