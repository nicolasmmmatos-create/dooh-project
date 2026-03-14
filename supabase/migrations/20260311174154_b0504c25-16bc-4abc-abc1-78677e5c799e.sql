CREATE OR REPLACE FUNCTION public.get_all_active_screens()
 RETURNS TABLE(playlist_id uuid, active_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Cleanup inline instead of calling separate function to avoid STABLE conflict
  UPDATE public.devices
  SET is_active = false
  WHERE last_seen < NOW() - INTERVAL '3 minutes'
    AND is_active = true;

  RETURN QUERY
  SELECT 
    p.id AS playlist_id,
    COUNT(d.id) AS active_count
  FROM public.playlists p
  LEFT JOIN public.devices d 
    ON d.playlist_id = p.id 
    AND d.last_seen > NOW() - INTERVAL '3 minutes'
  WHERE p.user_id = auth.uid()
  GROUP BY p.id;
END;
$function$;