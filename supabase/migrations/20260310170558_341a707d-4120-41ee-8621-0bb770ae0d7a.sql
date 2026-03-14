
-- 1. Make videos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'videos';

-- 2. Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public can read videos" ON storage.objects;

-- 3. Add policy so authenticated users can read their own videos
CREATE POLICY "Authenticated users can read own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Fix devices UPDATE policy - replace with a SECURITY DEFINER function approach
DROP POLICY IF EXISTS "Public can update own device via valid token" ON public.devices;

-- Create a secure function for device heartbeat updates
CREATE OR REPLACE FUNCTION public.update_device_heartbeat(
  p_device_id uuid,
  p_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate the token is active and get the playlist_id
  UPDATE public.devices d
  SET last_seen = now()
  WHERE d.id = p_device_id
    AND d.playlist_id IN (
      SELECT at.playlist_id
      FROM public.access_tokens at
      WHERE at.token = p_token
        AND (at.expires_at IS NULL OR at.expires_at > now())
    );
END;
$$;
