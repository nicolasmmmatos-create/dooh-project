CREATE OR REPLACE FUNCTION public.get_or_create_playlist_token(p_playlist_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id 
  FROM public.playlists 
  WHERE id = p_playlist_id AND user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT token INTO v_token
  FROM public.access_tokens
  WHERE playlist_id = p_playlist_id AND is_primary = true;

  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.access_tokens (playlist_id, token, is_primary, expires_at)
    VALUES (p_playlist_id, v_token, true, NULL)
    ON CONFLICT ON CONSTRAINT idx_tokens_primary_per_playlist DO UPDATE
      SET token = access_tokens.token
    RETURNING token INTO v_token;
  END IF;

  RETURN v_token;
END;
$function$;