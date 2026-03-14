DROP FUNCTION IF EXISTS public.validate_token(text);

CREATE FUNCTION public.validate_token(p_token text)
 RETURNS TABLE(playlist_id uuid, playlist_name text, video_urls text[], video_pages integer[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    ARRAY_AGG(
      v.storage_path ORDER BY v.page_number, v.order_index
    ) as video_urls,
    ARRAY_AGG(
      v.page_number ORDER BY v.page_number, v.order_index
    ) as video_pages
  FROM access_tokens t
  JOIN playlists p ON p.id = t.playlist_id
  LEFT JOIN videos v ON v.playlist_id = p.id
  WHERE t.token = p_token
    AND p.active = true
    AND (t.expires_at IS NULL OR t.expires_at > NOW())
  GROUP BY p.id, p.name;
END;
$$;