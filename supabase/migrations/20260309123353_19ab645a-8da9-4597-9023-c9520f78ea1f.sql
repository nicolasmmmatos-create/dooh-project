
-- Drop the overly permissive policy
DROP POLICY "Public can update devices via token" ON public.devices;

-- Create a restricted update policy: public users can only update their own device
-- by matching the device's playlist_id to a valid, unexpired access token
CREATE POLICY "Public can update own device via valid token" ON public.devices
  FOR UPDATE TO public
  USING (
    playlist_id IN (
      SELECT at.playlist_id
      FROM public.access_tokens at
      WHERE (at.expires_at IS NULL OR at.expires_at > now())
    )
  );
